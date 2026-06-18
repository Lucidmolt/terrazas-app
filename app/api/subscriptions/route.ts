import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import { geocodeAddress } from '@/lib/google-maps';
import { calculateDynamicPrice } from '@/lib/pricing';
import { broadcastJobToProviders } from '@/lib/notifications';

// GET /api/subscriptions — list active subscriptions for the logged-in customer
export async function GET() {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const subscriptions = await db.subscription.findMany({
      where: {
        customerId: dbUser!.id,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ subscriptions });
  } catch (error: any) {
    console.error('[Subscriptions GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

// POST /api/subscriptions — create a new recurring subscription and create the first job immediately
export async function POST(request: Request) {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    let {
      serviceType, tier, scope, lotSize, address,
      frequencyDays, preferredProId,
      photoFrontUrl, photoBackUrl, photoExtraUrl,
      latitude, longitude, placeId,
    } = body;

    if (!address) {
      return NextResponse.json({ error: 'Address is required to set up a subscription' }, { status: 400 });
    }

    const freq = parseInt(frequencyDays);
    if (isNaN(freq) || ![7, 10, 14, 30].includes(freq)) {
      return NextResponse.json({ error: 'Invalid frequency. Choose 7, 10, 14, or 30 days.' }, { status: 400 });
    }

    // Resolve geocoding if coords are missing
    let zipCode = '';
    if (!latitude || !longitude) {
      const geo = await geocodeAddress(address);
      if (geo) {
        latitude = geo.lat;
        longitude = geo.lng;
        placeId = placeId || geo.placeId;
        zipCode = geo.zipCode;
      }
    }

    if (!zipCode) {
      zipCode = '67901';
    }

    // Calculate pricing for the first job
    const pricing = await calculateDynamicPrice({
      tier: tier || 'basic',
      scope: scope || 'front_back',
      conditionScore: undefined,
      lotSize: lotSize || 'medium',
      urgency: 'scheduled',
      extras: [],
      zipCode,
      tipAmount: 0,
    });

    // Set first job due date (subsequent job is due freq days from now)
    const nextJobDueDate = new Date(Date.now() + freq * 24 * 60 * 60 * 1000);

    const subscription = await db.subscription.create({
      data: {
        customerId: dbUser!.id,
        serviceType: serviceType || 'mowing',
        tier: tier || 'basic',
        scope: scope || 'front_back',
        lotSize: lotSize || 'medium',
        address,
        latitude: latitude || null,
        longitude: longitude || null,
        placeId: placeId || null,
        frequencyDays: freq,
        preferredProId: preferredProId || null,
        photoFrontUrl: photoFrontUrl || null,
        photoBackUrl: photoBackUrl || null,
        photoExtraUrl: photoExtraUrl || null,
        nextJobDueDate,
      },
    });

    // Create first job immediately
    const job = await db.job.create({
      data: {
        customerId: dbUser!.id,
        zipCode,
        address,
        latitude: latitude || null,
        longitude: longitude || null,
        placeId: placeId || null,
        serviceType: serviceType || 'mowing',
        tier: tier || 'basic',
        scope: scope || 'front_back',
        lotSize: lotSize || 'medium',
        urgency: 'scheduled',
        conditionGrade: pricing.conditionGrade,
        extras: '[]',
        basePrice: pricing.basePrice,
        scopeMultiplier: pricing.scopeMultiplier,
        conditionMult: pricing.conditionMultiplier,
        demandMultiplier: pricing.demandMultiplier,
        lotSizeMultiplier: pricing.lotSizeMultiplier,
        urgencyMultiplier: pricing.urgencyMultiplier,
        price: pricing.jobPrice,
        serviceFee: pricing.serviceFee,
        processingFee: pricing.processingFee,
        extrasTotal: pricing.extrasTotal,
        customerTotal: pricing.customerTotal,
        providerPayout: pricing.providerPayout,
        photoFrontUrl: photoFrontUrl || null,
        photoBackUrl: photoBackUrl || null,
        photoExtraUrl: photoExtraUrl || null,
        status: preferredProId ? 'pending_claim' : 'broadcast',
        providerId: preferredProId || null,
        broadcastedAt: !preferredProId ? new Date() : null,
      },
    });

    // Trigger notification/broadcast for the first job
    if (!preferredProId) {
      broadcastJobToProviders(job.id).catch((err) => {
        console.error('[Subscriptions POST] Broadcast error for job:', err);
      });
    } else {
      const preferredPro = await db.provider.findUnique({
        where: { id: preferredProId },
      });
      if (preferredPro) {
        await db.notification.create({
          data: {
            userId: preferredPro.userId,
            jobId: job.id,
            type: 'job_broadcast',
            channel: 'in_app',
            title: '⭐ Direct Job Offer (Recurring)',
            body: `A customer has requested you directly for a recurring ${job.serviceType} at ${job.address.split(',')[0]} ($${job.price.toFixed(2)}). Claim it now!`,
            isSent: true,
            sentAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({ subscription, job }, { status: 201 });
  } catch (error: any) {
    console.error('[Subscriptions POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create subscription' }, { status: 500 });
  }
}

// DELETE /api/subscriptions — cancel an active subscription (by ?id=...)
export async function DELETE(request: Request) {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 });
    }

    const subscription = await db.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    if (subscription.customerId !== dbUser!.id) {
      return NextResponse.json({ error: 'Forbidden: not authorized to cancel this subscription' }, { status: 403 });
    }

    const updated = await db.subscription.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, subscription: updated });
  } catch (error: any) {
    console.error('[Subscriptions DELETE] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to cancel subscription' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { geocodeAddress } from '@/lib/google-maps';
import { calculateDynamicPrice } from '@/lib/pricing';
import { broadcastJobToProviders } from '@/lib/notifications';

// GET /api/jobs — list jobs (broadcast for pros, own for customers)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const zip = searchParams.get('zip');
  const customerId = searchParams.get('customerId');

  try {
    // ── Inline auto-approve: resolve expired 10-min veto deadlines ──
    const expired = await db.job.findMany({
      where: {
        status: 'pending_approval',
        approvalDeadline: { lte: new Date() },
      },
    });
    if (expired.length > 0) {
      await db.job.updateMany({
        where: { id: { in: expired.map(j => j.id) } },
        data: { status: 'active', autoApproved: true, approvedAt: new Date() },
      });
    }

    const where: any = {};

    // Support comma-separated statuses: ?status=active,en_route
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    if (zip) where.zipCode = zip;
    if (customerId) where.customerId = customerId;

    const jobs = await db.job.findMany({
      where,
      include: {
        provider: { select: { id: true, businessName: true, rating: true, reviewCount: true, avatarUrl: true, logoUrl: true, bio: true, portfolioPhotos: true, isVerified: true, profileStatus: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ jobs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/jobs — create a new job with dynamic pricing
export async function POST(request: Request) {
  try {
    const body = await request.json();
    let {
      customerId, zipCode, address, latitude, longitude, placeId,
      serviceType, tier, providerId, customerNotes,
      // Dynamic pricing inputs
      scope, lotSize, urgency, conditionScore, extras,
      // Photos
      photoFrontUrl, photoBackUrl, photoExtraUrl,
      // Optional override (admin/testing only)
      priceOverride,
    } = body;

    if (!zipCode) {
      return NextResponse.json({ error: 'zipCode is required' }, { status: 400 });
    }

    // Resolve customer ID
    if (!customerId || customerId.startsWith('demo')) {
      const demoCustomer = await db.user.findFirst({ where: { role: 'customer' } });
      if (!demoCustomer) {
        return NextResponse.json({ error: 'No customer found in database' }, { status: 500 });
      }
      customerId = demoCustomer.id;
    }

    // Resolve provider ID
    if (providerId && providerId.startsWith('demo')) {
      const demoPro = await db.provider.findFirst({ where: { isActive: true } });
      providerId = demoPro?.id || null;
    }

    // Auto-geocode address
    if (address && (!latitude || !longitude)) {
      const geo = await geocodeAddress(address);
      if (geo) {
        latitude = geo.lat;
        longitude = geo.lng;
        placeId = placeId || geo.placeId;
        zipCode = zipCode || geo.zipCode;
      }
    }

    // ── Dynamic Pricing ──
    const pricing = await calculateDynamicPrice({
      tier: tier || 'basic',
      scope: scope || 'front_back',
      conditionScore: conditionScore || undefined,
      lotSize: lotSize || 'medium',
      urgency: urgency || 'same_day',
      extras: extras || [],
      zipCode,
      tipAmount: 0,
    });

    const job = await db.job.create({
      data: {
        customerId,
        zipCode,
        address: address || `Service in ${zipCode}`,
        latitude: latitude || null,
        longitude: longitude || null,
        placeId: placeId || null,
        serviceType: serviceType || 'mowing',
        tier: tier || 'basic',

        // Pricing variables
        scope: scope || 'front_back',
        lotSize: lotSize || 'medium',
        urgency: urgency || 'same_day',
        conditionScore: conditionScore || null,
        conditionGrade: pricing.conditionGrade,
        extras: JSON.stringify(extras || []),

        // Stored multipliers (for transparency/audit)
        basePrice: pricing.basePrice,
        scopeMultiplier: pricing.scopeMultiplier,
        conditionMult: pricing.conditionMultiplier,
        demandMultiplier: pricing.demandMultiplier,
        lotSizeMultiplier: pricing.lotSizeMultiplier,
        urgencyMultiplier: pricing.urgencyMultiplier,

        // Final amounts
        price: priceOverride || pricing.jobPrice,
        serviceFee: pricing.serviceFee,
        processingFee: pricing.processingFee,
        extrasTotal: pricing.extrasTotal,
        customerTotal: pricing.customerTotal,
        providerPayout: pricing.providerPayout,

        // Photos
        photoFrontUrl: photoFrontUrl || null,
        photoBackUrl: photoBackUrl || null,
        photoExtraUrl: photoExtraUrl || null,

        // Meta
        surgeLevel: pricing.surgeLevel,
        customerNotes: customerNotes || null,
        providerId: providerId || null,
        status: providerId ? 'pending_claim' : 'broadcast',
        broadcastedAt: !providerId ? new Date() : null,
      },
    });

    // 🔔 Broadcast to eligible providers (non-blocking)
    if (!providerId) {
      broadcastJobToProviders(job.id).catch((err) => {
        console.error('Broadcast error:', err);
      });
    }

    return NextResponse.json({
      job,
      pricing: {
        basePrice: pricing.basePrice,
        jobPrice: pricing.jobPrice,
        serviceFee: pricing.serviceFee,
        processingFee: pricing.processingFee,
        extrasTotal: pricing.extrasTotal,
        customerTotal: pricing.customerTotal,
        providerPayout: pricing.providerPayout,
        platformRevenue: pricing.platformRevenue,
        multipliers: {
          scope: { value: pricing.scopeMultiplier, label: pricing.scopeLabel },
          condition: { value: pricing.conditionMultiplier, label: pricing.conditionLabel },
          demand: { value: pricing.demandMultiplier, label: pricing.demandLabel },
          lotSize: { value: pricing.lotSizeMultiplier, label: pricing.lotSizeLabel },
          urgency: { value: pricing.urgencyMultiplier, label: pricing.urgencyLabel },
        },
        surgeLevel: pricing.surgeLevel,
        priceWasCapped: pricing.priceWasCapped,
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


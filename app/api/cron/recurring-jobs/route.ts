import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCronSecret } from '@/lib/api-auth';
import { calculateDynamicPrice } from '@/lib/pricing';
import { geocodeAddress } from '@/lib/google-maps';
import { broadcastJobToProviders } from '@/lib/notifications';

// GET /api/cron/recurring-jobs
// Triggered by Vercel Cron daily at 7am UTC (2am CDT)
// Finds active subscriptions that are due, creates a new job record for them,
// and schedules the next job.
export async function GET(request: Request) {
  const cronError = requireCronSecret(request);
  if (cronError) return cronError;

  try {
    const now = new Date();

    // Fetch all active subscriptions that are due
    const subscriptions = await db.subscription.findMany({
      where: {
        isActive: true,
        nextJobDueDate: { lte: now },
      },
      include: {
        customer: true,
      },
    });

    console.log(`[Cron:Recurring] Found ${subscriptions.length} subscriptions due for execution`);

    let createdJobsCount = 0;
    const details = [];

    for (const sub of subscriptions) {
      // 1. Resolve coordinates / zipCode
      let zipCode = '';
      let lat = sub.latitude;
      let lng = sub.longitude;
      let placeId = sub.placeId;

      const geo = await geocodeAddress(sub.address);
      if (geo) {
        lat = lat || geo.lat;
        lng = lng || geo.lng;
        placeId = placeId || geo.placeId;
        zipCode = geo.zipCode;
      }

      if (!zipCode) {
        // Fallback
        zipCode = '67901'; // Default service area zip
      }

      // 2. Calculate dynamic pricing for the recurring job
      const pricing = await calculateDynamicPrice({
        tier: (sub.tier === 'premium' ? 'premium' : 'basic') as 'basic' | 'premium',
        scope: (sub.scope === 'front_only' || sub.scope === 'back_only' || sub.scope === 'front_back' || sub.scope === 'full_property' ? sub.scope : 'front_back') as 'front_only' | 'back_only' | 'front_back' | 'full_property',
        conditionScore: undefined, // Recalculate based on default/averages
        lotSize: (sub.lotSize === 'small' || sub.lotSize === 'medium' || sub.lotSize === 'large' || sub.lotSize === 'xl' ? sub.lotSize : 'medium') as 'small' | 'medium' | 'large' | 'xl',
        urgency: 'scheduled', // Recurring bookings are marked as scheduled
        extras: [],
        zipCode,
        tipAmount: 0,
      });

      // 3. Create the job record
      const job = await db.job.create({
        data: {
          customerId: sub.customerId,
          zipCode,
          address: sub.address,
          latitude: lat || null,
          longitude: lng || null,
          placeId: placeId || null,
          serviceType: sub.serviceType || 'mowing',
          tier: sub.tier || 'basic',
          scope: sub.scope || 'front_back',
          lotSize: sub.lotSize || 'medium',
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
          photoFrontUrl: sub.photoFrontUrl,
          photoBackUrl: sub.photoBackUrl,
          photoExtraUrl: sub.photoExtraUrl,
          status: sub.preferredProId ? 'pending_claim' : 'broadcast',
          providerId: sub.preferredProId || null,
          broadcastedAt: !sub.preferredProId ? now : null,
        },
      });

      // 4. Update the subscription with next dates
      const nextDue = new Date(now.getTime() + sub.frequencyDays * 24 * 60 * 60 * 1000);
      await db.subscription.update({
        where: { id: sub.id },
        data: {
          lastJobCreatedAt: now,
          nextJobDueDate: nextDue,
        },
      });

      // 5. Trigger notifications / broadcasts
      if (!sub.preferredProId) {
        broadcastJobToProviders(job.id).catch((err) => {
          console.error(`[Cron:Recurring] Broadcast error for job ${job.id}:`, err);
        });
      } else {
        // Target direct offer notification
        const preferredPro = await db.provider.findUnique({
          where: { id: sub.preferredProId },
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

      createdJobsCount++;
      details.push({ subscriptionId: sub.id, jobId: job.id, address: sub.address });
    }

    return NextResponse.json({
      success: true,
      processed: subscriptions.length,
      createdJobs: createdJobsCount,
      details,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron:Recurring] Execution failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

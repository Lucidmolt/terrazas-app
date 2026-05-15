import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { geocodeAddress } from '@/lib/google-maps';
import { calculateDynamicPrice } from '@/lib/pricing';
import { broadcastJobToProviders } from '@/lib/notifications';
import { maskJobsForViewer } from '@/lib/context-envelope';
import { runEscalationCheck } from '@/lib/escalation';
import { requireAuth } from '@/lib/api-auth';

// GET /api/jobs — list jobs (broadcast for pros, own for customers)
export async function GET(request: Request) {
  // C1 FIX: Require authentication
  const { user, dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const zip = searchParams.get('zip');

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

    // ── Master Parachute: T+60 unclaimed job escalation ──
    const sixtyMinsAgo = new Date(Date.now() - 60 * 60 * 1000);
    const staleJobs = await db.job.findMany({
      where: {
        status: 'broadcast',
        broadcastedAt: { lte: sixtyMinsAgo },
        surgeLevel: { not: 'parachute' }, // Don't re-trigger
      },
    });
    if (staleJobs.length > 0) {
      for (const staleJob of staleJobs) {
        // Boost provider payout by 5%
        const boostedPayout = Math.round(staleJob.providerPayout * 1.05 * 100) / 100;
        await db.job.update({
          where: { id: staleJob.id },
          data: {
            providerPayout: boostedPayout,
            surgeLevel: 'parachute',
          },
        });

        // Create admin notification
        await db.notification.create({
          data: {
            userId: staleJob.customerId, // Will also be visible in admin panel
            jobId: staleJob.id,
            type: 'system',
            channel: 'in_app',
            title: '⚠️ Job unclaimed for 60+ minutes',
            body: `Job in ${staleJob.zipCode} ($${staleJob.price}) has no provider. Payout boosted to $${boostedPayout}. Consider manual dispatch.`,
            isSent: true,
            sentAt: new Date(),
          },
        });
      }
      console.log(`[Parachute] Boosted ${staleJobs.length} stale jobs`);
    }

    // ── System 2: Time Dilation Escalation ──
    // Promote broadcast jobs up the visibility ladder based on effective age
    runEscalationCheck().catch((err) => {
      console.error('[Escalation] Check error:', err);
    });

    const where: any = {};

    // Support comma-separated statuses: ?status=active,en_route
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    if (zip) where.zipCode = zip;

    // M1 FIX: Scope queries to the authenticated user's own data
    const viewerRole = dbUser?.role || 'customer';
    const viewerId = dbUser?.id;

    if (viewerRole === 'customer') {
      // Customers only see their own jobs + broadcast jobs
      where.OR = [
        { customerId: viewerId },
        { status: 'broadcast' },
      ];
    }
    // Pros and admins can see all matching jobs (filtered by status/zip)

    const jobs = await db.job.findMany({
      where,
      include: {
        provider: { select: { id: true, businessName: true, rating: true, reviewCount: true, avatarUrl: true, logoUrl: true, bio: true, portfolioPhotos: true, isVerified: true, profileStatus: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // ── System 3: Apply Sovereign Context Envelope ──
    // Mask sensitive data based on who's viewing
    const maskedJobs = maskJobsForViewer(jobs, viewerId || null, viewerRole);

    return NextResponse.json({ jobs: maskedJobs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/jobs — create a new job with dynamic pricing
export async function POST(request: Request) {
  // C1 FIX: Require authentication
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    let {
      zipCode, address, latitude, longitude, placeId,
      serviceType, tier, providerId, customerNotes,
      // Dynamic pricing inputs
      scope, lotSize, urgency, conditionScore, extras,
      // Photos
      photoFrontUrl, photoBackUrl, photoExtraUrl,
    } = body;

    if (!zipCode) {
      return NextResponse.json({ error: 'zipCode is required' }, { status: 400 });
    }

    // M1 FIX: Use the authenticated user's ID — no arbitrary customerId from body
    const customerId = dbUser!.id;

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

        // Final amounts — no priceOverride from client
        price: pricing.jobPrice,
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

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { geocodeAddress } from '@/lib/google-maps';
import { calculateDynamicPrice } from '@/lib/pricing';
import { maskJobsForViewer } from '@/lib/context-envelope';
import { requireAuth } from '@/lib/api-auth';
import { getService, isZipServed, BUSINESS } from '@/lib/business';
import { getBusinessProvider } from '@/lib/business-server';
import { sendNewRequestEmail } from '@/lib/email';

// GET /api/jobs — list jobs (own jobs for customers, assigned requests for the business)
export async function GET(request: Request) {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const zip = searchParams.get('zip');

  try {
    // ── Auto-approve expired price-adjustment approvals ──
    // Only jobs that were given an approvalDeadline (legacy marketplace claims).
    // Quote requests never get a deadline — a quote must be explicitly accepted.
    const expired = await db.job.findMany({
      where: {
        status: 'pending_approval',
        approvalDeadline: { lte: new Date() },
        requestType: { not: 'quote' },
      },
    });
    if (expired.length > 0) {
      await db.job.updateMany({
        where: { id: { in: expired.map(j => j.id) } },
        data: { status: 'active', autoApproved: true, approvedAt: new Date() },
      });
    }

    const where: any = {};

    // Scope queries to the authenticated user's own data
    const viewerRole = dbUser?.role || 'customer';
    const viewerId = dbUser?.id;

    let provider = null;
    if (viewerRole === 'pro' && viewerId) {
      provider = await db.provider.findUnique({ where: { userId: viewerId } });
    }

    // Support comma-separated statuses: ?status=active,en_route
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      if (viewerRole === 'pro' && provider && statuses.includes('broadcast')) {
        // "broadcast" from the pro dashboard means: new requests waiting on the
        // business to accept or quote (single-business mode assigns them directly).
        const otherStatuses = statuses.filter(s => s !== 'broadcast');
        where.OR = [
          { status: 'broadcast' },
          { status: 'pending_claim', providerId: provider.id },
          ...(otherStatuses.length > 0 ? [{ status: { in: otherStatuses }, providerId: provider.id }] : [])
        ];
      } else {
        where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
      }
    }
    if (zip) where.zipCode = zip;

    if (viewerRole === 'customer') {
      // Customers only ever see their own jobs
      where.customerId = viewerId;
    } else if (viewerRole === 'pro' && provider && !where.OR) {
      // Pros see jobs assigned to them
      where.providerId = provider.id;
    }
    // Admins can see all matching jobs (filtered by status/zip)

    const jobs = await db.job.findMany({
      where,
      include: {
        provider: { select: { id: true, businessName: true, rating: true, reviewCount: true, avatarUrl: true, logoUrl: true, bio: true, portfolioPhotos: true, isVerified: true, profileStatus: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Mask sensitive data based on who's viewing.
    // Pros are identified by their Provider id (job.providerId is a Provider id, not a User id).
    const viewerKey = viewerRole === 'pro' && provider ? provider.id : viewerId;
    const maskedJobs = maskJobsForViewer(jobs, viewerKey || null, viewerRole);

    return NextResponse.json({ jobs: maskedJobs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/jobs — create a booking or quote request, assigned to the business
export async function POST(request: Request) {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    let {
      zipCode, address, latitude, longitude, placeId,
      serviceType, requestType, preferredDate, timeWindow,
      tier, customerNotes,
      // Dynamic pricing inputs (fixed-price bookings only)
      scope, lotSize, urgency, conditionScore, extras,
      // Photos
      photoFrontUrl, photoBackUrl, photoExtraUrl,
    } = body;

    if (!zipCode) {
      return NextResponse.json({ error: 'zipCode is required' }, { status: 400 });
    }

    const service = getService(serviceType || 'mowing');
    if (!service) {
      return NextResponse.json({ error: `Unknown service: ${serviceType}` }, { status: 400 });
    }
    // Quote-only services always go through the quote flow
    const isQuote = requestType === 'quote' || service.mode === 'quote';

    if (!isZipServed(zipCode)) {
      return NextResponse.json({
        error: 'OUTSIDE_SERVICE_AREA',
        message: `We don't currently serve ${zipCode}. Call ${BUSINESS.phone} — we may still be able to help.`,
      }, { status: 400 });
    }

    // Route every request to the business's provider record
    const businessProvider = await getBusinessProvider();
    if (!businessProvider) {
      return NextResponse.json({
        error: 'NO_PROVIDER',
        message: `Online booking is temporarily unavailable. Please call ${BUSINESS.phone}.`,
      }, { status: 503 });
    }

    // Use the authenticated user's ID — no arbitrary customerId from body
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

    // ── Duplicate Request Guard (Idempotency) ──
    const targetAddress = address || `Service in ${zipCode}`;
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const existingJob = await db.job.findFirst({
      where: {
        customerId,
        serviceType: service.id,
        address: targetAddress,
        createdAt: { gte: twoMinutesAgo },
        status: {
          in: ['broadcast', 'pending_claim', 'pending_approval', 'active', 'en_route', 'in_progress'],
        },
      },
    });

    if (existingJob) {
      return NextResponse.json(
        {
          error: 'DUPLICATE_REQUEST',
          message: 'You already submitted an identical request in the last 2 minutes. Please check your active jobs.',
          jobId: existingJob.id,
        },
        { status: 409 }
      );
    }

    // ── Pricing ──
    // Fixed-price bookings get the dynamic price; quote requests start at $0
    // until the business responds with a price.
    const pricing = isQuote ? null : await calculateDynamicPrice({
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
        address: targetAddress,
        latitude: latitude || null,
        longitude: longitude || null,
        placeId: placeId || null,
        serviceType: service.id,
        requestType: isQuote ? 'quote' : 'book',
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        timeWindow: timeWindow || null,
        tier: tier || 'basic',

        // Pricing variables
        scope: scope || 'front_back',
        lotSize: lotSize || 'medium',
        urgency: urgency || 'same_day',
        conditionScore: conditionScore || null,
        conditionGrade: pricing?.conditionGrade ?? null,
        extras: JSON.stringify(extras || []),

        // Stored multipliers (for transparency/audit)
        basePrice: pricing?.basePrice ?? 0,
        scopeMultiplier: pricing?.scopeMultiplier ?? 1,
        conditionMult: pricing?.conditionMultiplier ?? 1,
        demandMultiplier: pricing?.demandMultiplier ?? 1,
        lotSizeMultiplier: pricing?.lotSizeMultiplier ?? 1,
        urgencyMultiplier: pricing?.urgencyMultiplier ?? 1,

        // Final amounts — no priceOverride from client
        price: pricing?.jobPrice ?? 0,
        serviceFee: pricing?.serviceFee ?? 0,
        processingFee: pricing?.processingFee ?? 0,
        extrasTotal: pricing?.extrasTotal ?? 0,
        customerTotal: pricing?.customerTotal ?? 0,
        providerPayout: pricing?.providerPayout ?? 0,

        // Photos
        photoFrontUrl: photoFrontUrl || null,
        photoBackUrl: photoBackUrl || null,
        photoExtraUrl: photoExtraUrl || null,

        // Meta
        surgeLevel: pricing?.surgeLevel ?? null,
        customerNotes: customerNotes || null,

        // Single-business mode: every request is a direct offer to the business
        providerId: businessProvider.id,
        pendingProId: businessProvider.id,
        preferredProId: businessProvider.id,
        broadcastTier: 0,
        status: 'pending_claim',
      },
    });

    // 🔔 Notify the business (non-blocking): in-app + email
    (async () => {
      await db.notification.create({
        data: {
          userId: businessProvider.userId,
          jobId: job.id,
          type: isQuote ? 'quote_request' : 'new_booking',
          channel: 'in_app',
          title: isQuote ? '📋 New quote request' : '🌱 New booking',
          body: `${service.name} at ${targetAddress}${pricing ? ` — $${pricing.customerTotal.toFixed(2)}` : ''}`,
          isSent: true,
          sentAt: new Date(),
        },
      });
      const businessEmail = businessProvider.user?.email || BUSINESS.email;
      if (businessEmail) {
        await sendNewRequestEmail(businessEmail, {
          requestType: isQuote ? 'quote' : 'book',
          serviceName: service.name,
          address: targetAddress,
          preferredDate: preferredDate ? new Date(preferredDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : undefined,
          customerName: dbUser!.name || undefined,
          total: pricing ? pricing.customerTotal.toFixed(2) : undefined,
        });
      }
    })().catch((err) => console.error('[Jobs] Business notification error:', err));

    return NextResponse.json({
      job,
      pricing: pricing ? {
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
      } : null,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { geocodeAddress } from '@/lib/google-maps';
import { calculatePricing } from '@/lib/constants';
import { broadcastJobToProviders } from '@/lib/notifications';

// GET /api/jobs — list jobs (broadcast for pros, own for customers)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const zip = searchParams.get('zip');
  const customerId = searchParams.get('customerId');

  try {
    const where: any = {};

    if (status) where.status = status;
    if (zip) where.zipCode = zip;
    if (customerId) where.customerId = customerId;

    const jobs = await db.job.findMany({
      where,
      include: {
        provider: { select: { id: true, businessName: true, rating: true, avatarUrl: true } },
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

// POST /api/jobs — create a new job (broadcast or direct)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { customerId, zipCode, address, latitude, longitude, placeId, serviceType, tier, price, providerId, customerNotes } = body;

    if (!zipCode) {
      return NextResponse.json({ error: 'zipCode is required' }, { status: 400 });
    }

    // Demo mode: resolve actual customer ID from DB if placeholder is used
    if (!customerId || customerId.startsWith('demo')) {
      const demoCustomer = await db.user.findFirst({ where: { role: 'customer' } });
      if (!demoCustomer) {
        return NextResponse.json({ error: 'No customer found in database. Run: npm run db:seed' }, { status: 500 });
      }
      customerId = demoCustomer.id;
    }

    // Demo mode: resolve provider ID if placeholder
    if (providerId && providerId.startsWith('demo')) {
      const demoPro = await db.provider.findFirst({ where: { isActive: true } });
      providerId = demoPro?.id || null;
    }

    // Auto-geocode address if lat/lng not provided
    if (address && (!latitude || !longitude)) {
      const geo = await geocodeAddress(address);
      if (geo) {
        latitude = geo.lat;
        longitude = geo.lng;
        placeId = placeId || geo.placeId;
        zipCode = zipCode || geo.zipCode;
      }
    }

    // Calculate pricing with platform fees
    const jobPrice = price || 45;
    const pricing = calculatePricing(jobPrice);

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
        price: jobPrice,
        serviceFee: pricing.serviceFee,
        processingFee: pricing.processingFee,
        customerTotal: pricing.customerTotal,
        providerPayout: pricing.providerPayout,
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
        jobPrice: pricing.jobPrice,
        serviceFee: pricing.serviceFee,
        processingFee: pricing.processingFee,
        customerTotal: pricing.customerTotal,
        providerPayout: pricing.providerPayout,
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


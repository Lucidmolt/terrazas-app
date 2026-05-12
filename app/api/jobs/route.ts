import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { geocodeAddress } from '@/lib/google-maps';

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
    let { customerId, zipCode, address, latitude, longitude, placeId, serviceType, tier, price, providerId } = body;

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
        price: price || 45,
        providerId: providerId || null,
        status: providerId ? 'pending_claim' : 'broadcast',
      },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


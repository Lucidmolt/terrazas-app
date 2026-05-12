import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get('zip');

  if (!zip || zip.length !== 5 || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: 'Valid 5-digit zip code required' }, { status: 400 });
  }

  try {
    const allProviders = await db.provider.findMany({
      where: { isActive: true },
      select: { id: true, businessName: true, rating: true, isVerified: true, zipCodes: true },
    });

    const matching = allProviders.filter((p) => {
      try {
        const zips: string[] = JSON.parse(p.zipCodes);
        return zips.includes(zip);
      } catch {
        return false;
      }
    });

    return NextResponse.json({
      serviceable: matching.length > 0,
      provider_count: matching.length,
      message: matching.length > 0
        ? `${matching.length} active pro${matching.length > 1 ? 's' : ''} found!`
        : 'Not yet active in your area. Join the waitlist!',
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

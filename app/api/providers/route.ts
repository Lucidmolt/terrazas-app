import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/providers?zip=xxxxx — find active providers in a zip code
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get('zip');

  try {
    // Get all active providers
    let providers = await db.provider.findMany({
      where: { isActive: true },
      include: { user: { select: { name: true } } },
      orderBy: { rating: 'desc' },
    });

    // Filter by zip code (zipCodes is stored as JSON string array in SQLite)
    if (zip) {
      providers = providers.filter((p) => {
        try {
          const zips: string[] = JSON.parse(p.zipCodes);
          return zips.includes(zip);
        } catch {
          return false;
        }
      });
    }

    return NextResponse.json({
      providers: providers.map((p) => ({
        id: p.id,
        businessName: p.businessName,
        rating: p.rating,
        reviewCount: p.reviewCount,
        isVerified: p.isVerified,
        isActive: p.isActive,
        avatarUrl: p.avatarUrl,
        ownerName: p.user.name,
      })),
      count: providers.length,
      serviceable: providers.length > 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

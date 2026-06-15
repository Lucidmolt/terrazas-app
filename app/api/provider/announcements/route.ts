import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireProvider, requireAuth } from '@/lib/api-auth';

// GET /api/provider/announcements — Retrieve active announcements for a zip code
export async function GET(request: Request) {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const zipCode = searchParams.get('zipCode');

  if (!zipCode) {
    return NextResponse.json({ error: 'zipCode query parameter is required' }, { status: 400 });
  }

  try {
    const announcements = await db.neighborhoodAnnouncement.findMany({
      where: {
        zipCode,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        provider: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ announcements });
  } catch (error: any) {
    console.error('[Announcements API] GET Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve announcements' },
      { status: 500 }
    );
  }
}

// POST /api/provider/announcements — Create a new availability announcement
export async function POST(request: Request) {
  const { provider, error: authError } = await requireProvider();
  if (authError) return authError;

  try {
    const { zipCode, hours } = await request.json();

    if (!zipCode || typeof zipCode !== 'string' || !zipCode.trim()) {
      return NextResponse.json({ error: 'Valid zipCode is required' }, { status: 400 });
    }

    const durationHours = parseInt(hours, 10);
    if (isNaN(durationHours) || durationHours <= 0 || durationHours > 24) {
      return NextResponse.json({ error: 'Hours must be a number between 1 and 24' }, { status: 400 });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + durationHours);

    // Create the announcement
    const announcement = await db.neighborhoodAnnouncement.create({
      data: {
        providerId: provider!.id,
        zipCode: zipCode.trim(),
        expiresAt,
      },
      include: {
        provider: true,
      },
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error: any) {
    console.error('[Announcements API] POST Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create announcement' },
      { status: 500 }
    );
  }
}

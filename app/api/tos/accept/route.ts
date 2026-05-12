import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const CURRENT_TOS_VERSION = '1.0';

// POST /api/tos/accept — Record TOS acceptance
export async function POST(request: Request) {
  try {
    const { userId, version } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id: userId },
      data: {
        tosAcceptedAt: new Date(),
        tosVersion: version || CURRENT_TOS_VERSION,
      },
    });

    return NextResponse.json({
      accepted: true,
      version: user.tosVersion,
      acceptedAt: user.tosAcceptedAt,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/tos/accept?userId=xxx — Check if user has accepted current TOS
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { tosAcceptedAt: true, tosVersion: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isCurrentVersion = user.tosVersion === CURRENT_TOS_VERSION;

    return NextResponse.json({
      accepted: !!user.tosAcceptedAt && isCurrentVersion,
      currentVersion: CURRENT_TOS_VERSION,
      userVersion: user.tosVersion,
      acceptedAt: user.tosAcceptedAt,
      needsReAccept: user.tosAcceptedAt && !isCurrentVersion,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

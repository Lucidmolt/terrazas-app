import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

const CURRENT_TOS_VERSION = '1.0';

// POST /api/tos/accept — Record TOS acceptance
export async function POST(request: Request) {
  // C1 FIX: Require authentication — use auth'd user
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { version } = await request.json();

    const user = await db.user.update({
      where: { id: dbUser!.id },
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

// GET /api/tos/accept — Check if authenticated user has accepted current TOS
export async function GET() {
  // C1 FIX: Require authentication
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  const isCurrentVersion = dbUser!.tosVersion === CURRENT_TOS_VERSION;

  return NextResponse.json({
    accepted: !!dbUser!.tosAcceptedAt && isCurrentVersion,
    currentVersion: CURRENT_TOS_VERSION,
    userVersion: dbUser!.tosVersion,
    acceptedAt: dbUser!.tosAcceptedAt,
    needsReAccept: dbUser!.tosAcceptedAt && !isCurrentVersion,
  });
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// POST /api/economy-ack — One-time Community Pro tier acknowledgment
export async function POST(request: Request) {
  // C1 FIX: Require authentication — use auth'd user, not arbitrary userId
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const userId = dbUser!.id;

    // Already acknowledged — no-op, just confirm
    if (dbUser!.economyAckedAt) {
      return NextResponse.json({
        acknowledged: true,
        acknowledgedAt: dbUser!.economyAckedAt,
        message: 'Economy tier already acknowledged.',
      });
    }

    // Record the one-time acknowledgment
    await db.user.update({
      where: { id: userId },
      data: { economyAckedAt: new Date() },
    });

    return NextResponse.json({
      acknowledged: true,
      acknowledgedAt: new Date(),
      message: 'Economy tier acknowledgment recorded. You will not be asked again.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/economy-ack — Check if authenticated user has acknowledged
export async function GET() {
  // C1 FIX: Require authentication
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  return NextResponse.json({
    acknowledged: !!dbUser!.economyAckedAt,
    acknowledgedAt: dbUser!.economyAckedAt,
  });
}

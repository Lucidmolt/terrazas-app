import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/economy-ack — One-time Community Pro tier acknowledgment
// Called when a customer first selects Economy rate. Stores the timestamp
// so they never have to confirm again. Subsequent economy bookings just
// show a passive inline notice.
export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Already acknowledged — no-op, just confirm
    if (user.economyAckedAt) {
      return NextResponse.json({
        acknowledged: true,
        acknowledgedAt: user.economyAckedAt,
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

// GET /api/economy-ack?userId=xxx — Check if user has acknowledged
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { economyAckedAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    acknowledged: !!user.economyAckedAt,
    acknowledgedAt: user.economyAckedAt,
  });
}

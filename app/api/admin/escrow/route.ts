import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { releaseEscrow } from '@/lib/risk-tier';
import { requireAdmin } from '@/lib/api-auth';

// GET /api/admin/escrow — List all escrow holds with provider info
export async function GET() {
  // H3 FIX: Require admin role
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const holds = await db.escrowHold.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Get unique provider IDs and fetch their info
    const providerIds = Array.from(new Set(holds.map(h => h.providerId)));
    const providers = await db.provider.findMany({
      where: { id: { in: providerIds } },
      select: {
        id: true,
        businessName: true,
        proTier: true,
        completedJobCount: true,
        escrowBalance: true,
        rating: true,
        user: { select: { name: true, email: true } },
      },
    });

    const providerMap = Object.fromEntries(providers.map(p => [p.id, p]));

    const enrichedHolds = holds.map(h => ({
      ...h,
      provider: providerMap[h.providerId] || null,
    }));

    // Summary stats
    const totalHeld = holds.filter(h => h.status === 'held').reduce((s, h) => s + h.amount, 0);
    const totalReleased = holds.filter(h => h.status === 'released').reduce((s, h) => s + h.amount, 0);
    const totalClaimed = holds.filter(h => h.status === 'claimed').reduce((s, h) => s + h.amount, 0);

    return NextResponse.json({
      holds: enrichedHolds,
      summary: {
        totalHeld: Math.round(totalHeld * 100) / 100,
        totalReleased: Math.round(totalReleased * 100) / 100,
        totalClaimed: Math.round(totalClaimed * 100) / 100,
        holdCount: holds.filter(h => h.status === 'held').length,
        providersWithHolds: providerIds.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/escrow — Release or claim escrow holds
export async function POST(request: Request) {
  // H3 FIX: Require admin role
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const { action, providerId, holdId, reason } = await request.json();

    if (action === 'release_all') {
      // Release all held escrow for a provider
      if (!providerId) return NextResponse.json({ error: 'providerId required' }, { status: 400 });
      const result = await releaseEscrow(providerId);
      return NextResponse.json({ success: true, released: result.released });
    }

    if (action === 'claim') {
      // Claim a specific hold (for damage)
      if (!holdId) return NextResponse.json({ error: 'holdId required' }, { status: 400 });

      const hold = await db.escrowHold.findUnique({ where: { id: holdId } });
      if (!hold || hold.status !== 'held') {
        return NextResponse.json({ error: 'Hold not found or already processed' }, { status: 404 });
      }

      await db.escrowHold.update({
        where: { id: holdId },
        data: { status: 'claimed', reason: reason || 'Damage claim', releasedAt: new Date() },
      });

      // Deduct from provider's escrow balance
      await db.provider.update({
        where: { id: hold.providerId },
        data: { escrowBalance: { decrement: hold.amount } },
      });

      return NextResponse.json({ success: true, claimed: hold.amount });
    }

    if (action === 'release_one') {
      // Release a single hold back to provider
      if (!holdId) return NextResponse.json({ error: 'holdId required' }, { status: 400 });

      const hold = await db.escrowHold.findUnique({ where: { id: holdId } });
      if (!hold || hold.status !== 'held') {
        return NextResponse.json({ error: 'Hold not found or already processed' }, { status: 404 });
      }

      await db.escrowHold.update({
        where: { id: holdId },
        data: { status: 'released', releasedAt: new Date() },
      });

      await db.provider.update({
        where: { id: hold.providerId },
        data: {
          escrowBalance: { decrement: hold.amount },
          pendingPayout: { increment: hold.amount },
        },
      });

      return NextResponse.json({ success: true, released: hold.amount });
    }

    return NextResponse.json({ error: 'Invalid action. Use: release_all, release_one, claim' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

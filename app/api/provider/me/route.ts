import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/provider/me — Returns current provider's gig-tier info
// Used by the Pro Dashboard to show tier badge, upgrade CTA, and progress.
// In production, this would use auth session. For now, returns the first active provider.
export async function GET() {
  try {
    // TODO: Replace with actual auth — get provider from session
    const provider = await db.provider.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        proTier: true,
        upgradeEligible: true,
        completedJobCount: true,
        rating: true,
        escrowBalance: true,
        maxActiveJobs: true,
        equipmentTag: true,
        equipmentPhotoUrl: true,
        businessName: true,
        totalEarnings: true,
        pendingPayout: true,
      },
    });

    if (!provider) {
      return NextResponse.json({ provider: null }, { status: 404 });
    }

    return NextResponse.json({ provider });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/supabase-server';
import { requireProvider } from '@/lib/api-auth';

// GET /api/provider/me — Returns current provider's gig-tier info
// Uses auth session to identify the provider.
export async function GET() {
  // C2 FIX: Require authenticated provider — no dev fallback
  const { provider, error: authError } = await requireProvider();
  if (authError) return authError;

  try {
    // Fetch full provider details for dashboard
    const fullProvider = await db.provider.findUnique({
      where: { id: provider!.id },
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
        availablePayout: true,
        stripeAccountId: true,
        bankLinked: true,
        payoutSchedule: true,
        payoutHoldDays: true,
        freeInstant: true,
      },
    });

    if (!fullProvider) {
      return NextResponse.json({ provider: null }, { status: 404 });
    }

    return NextResponse.json({ provider: fullProvider });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

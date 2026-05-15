import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/supabase-server';

// GET /api/provider/me — Returns current provider's gig-tier info
// Uses auth session to identify the provider.
export async function GET() {
  try {
    // Get authenticated user from Supabase session
    const authUser = await getAuthUser();

    let provider;

    if (authUser?.email) {
      // Find provider linked to this authenticated user's email
      provider = await db.provider.findFirst({
        where: {
          email: authUser.email,
          isActive: true,
        },
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
    }

    // Fallback for development: return first active provider if no auth
    if (!provider && !authUser) {
      provider = await db.provider.findFirst({
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
          availablePayout: true,
          stripeAccountId: true,
          bankLinked: true,
          payoutSchedule: true,
          payoutHoldDays: true,
          freeInstant: true,
        },
      });
    }

    if (!provider) {
      return NextResponse.json({ provider: null }, { status: 404 });
    }

    return NextResponse.json({ provider });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

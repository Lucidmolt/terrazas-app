import { NextResponse } from 'next/server';
import { getPayoutSummary, requestInstantPayout } from '@/lib/payouts';
import { getAuthUser } from '@/lib/supabase-server';
import { db } from '@/lib/db';

// Helper: Get provider ID from auth session
async function getProviderFromAuth(): Promise<string | null> {
  const authUser = await getAuthUser();
  if (!authUser?.email) return null;

  const provider = await db.provider.findFirst({
    where: { email: authUser.email, isActive: true },
    select: { id: true },
  });

  return provider?.id || null;
}

// GET /api/provider/payout — Get payout summary for dashboard
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let providerId = searchParams.get('providerId');

  // Try auth session first, fall back to query param for dev
  const authProviderId = await getProviderFromAuth();
  if (authProviderId) {
    providerId = authProviderId;
  }

  if (!providerId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const summary = await getPayoutSummary(providerId);
    return NextResponse.json({ payout: summary });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/provider/payout — Request instant payout
export async function POST(request: Request) {
  try {
    const { providerId: bodyProviderId, action } = await request.json();

    // Try auth session first, fall back to body param for dev
    const authProviderId = await getProviderFromAuth();
    const providerId = authProviderId || bodyProviderId;

    if (!providerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (action === 'instant') {
      const result = await requestInstantPayout(providerId);

      if (!result.success) {
        return NextResponse.json({
          error: result.error,
          success: false,
        }, { status: 400 });
      }

      // Send payout email notification
      try {
        const provider = await db.provider.findUnique({ where: { id: providerId } });
        if (provider?.email) {
          const { sendPayoutEmail } = await import('@/lib/email');
          await sendPayoutEmail(
            provider.email,
            result.netPayout.toFixed(2),
            'instant',
            result.fee.toFixed(2)
          );
        }
      } catch {
        // Non-fatal
      }

      return NextResponse.json({
        success: true,
        payout: {
          netPayout: result.netPayout,
          fee: result.fee,
          transferId: result.transferId,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use: instant' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getPayoutSummary, requestInstantPayout } from '@/lib/payouts';
import { requireProvider } from '@/lib/api-auth';
import { db } from '@/lib/db';

// GET /api/provider/payout — Get payout summary for dashboard
export async function GET() {
  // C2 FIX: Require authenticated provider — no query param fallback
  const { provider, error: authError } = await requireProvider();
  if (authError) return authError;

  try {
    const summary = await getPayoutSummary(provider!.id);
    return NextResponse.json({ payout: summary });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/provider/payout — Request instant payout
export async function POST() {
  // C2 FIX: Require authenticated provider — no body param fallback
  const { provider, error: authError } = await requireProvider();
  if (authError) return authError;

  const providerId = provider!.id;

  try {
    const result = await requestInstantPayout(providerId);

    if (!result.success) {
      return NextResponse.json({
        error: result.error,
        success: false,
      }, { status: 400 });
    }

    // Send payout email notification
    try {
      const providerRecord = await db.provider.findUnique({ where: { id: providerId } });
      if (providerRecord?.email) {
        const { sendPayoutEmail } = await import('@/lib/email');
        await sendPayoutEmail(
          providerRecord.email,
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

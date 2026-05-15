import { NextResponse } from 'next/server';
import { getPayoutSummary, requestInstantPayout } from '@/lib/payouts';

// GET /api/provider/payout — Get payout summary for dashboard
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get('providerId');

  // TODO: In production, get providerId from auth session
  if (!providerId) {
    return NextResponse.json({ error: 'providerId required' }, { status: 400 });
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
    const { providerId, action } = await request.json();

    if (!providerId) {
      return NextResponse.json({ error: 'providerId required' }, { status: 400 });
    }

    if (action === 'instant') {
      const result = await requestInstantPayout(providerId);

      if (!result.success) {
        return NextResponse.json({
          error: result.error,
          success: false,
        }, { status: 400 });
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

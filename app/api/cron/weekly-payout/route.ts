import { NextResponse } from 'next/server';
import { processWeeklyPayouts } from '@/lib/payouts';

// GET /api/cron/weekly-payout
// Triggered by Vercel Cron every Friday at 10pm UTC (5pm CDT)
// Processes weekly batch payouts for all providers with available balances.
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron] Starting weekly payout batch...');
    const result = await processWeeklyPayouts();

    console.log(`[Cron] Weekly payout complete: ${result.processed} providers, $${result.totalPaid.toFixed(2)} total`);
    if (result.failures.length > 0) {
      console.error(`[Cron] Payout failures:`, result.failures);
    }

    return NextResponse.json({
      success: true,
      processed: result.processed,
      totalPaid: result.totalPaid,
      failures: result.failures,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron] Weekly payout failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

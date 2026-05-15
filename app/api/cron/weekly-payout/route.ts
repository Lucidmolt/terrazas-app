import { NextResponse } from 'next/server';
import { processWeeklyPayouts } from '@/lib/payouts';
import { requireCronSecret } from '@/lib/api-auth';

// GET /api/cron/weekly-payout
// Triggered by Vercel Cron every Friday at 10pm UTC (5pm CDT)
// Processes weekly batch payouts for all providers with available balances.
export async function GET(request: Request) {
  // H2 FIX: Fail-closed — require CRON_SECRET, reject if unset
  const cronError = requireCronSecret(request);
  if (cronError) return cronError;

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

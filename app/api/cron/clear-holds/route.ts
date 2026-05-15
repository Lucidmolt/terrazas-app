import { NextResponse } from 'next/server';
import { clearHeldFunds } from '@/lib/payouts';
import { db } from '@/lib/db';
import { requireCronSecret } from '@/lib/api-auth';

// GET /api/cron/clear-holds
// Triggered by Vercel Cron daily at 6am UTC (1am CDT)
// Moves funds past their hold period from pending → available.
// This ensures the "Available" balance is always up-to-date
// even if a provider hasn't opened their dashboard.
export async function GET(request: Request) {
  // H2 FIX: Fail-closed — require CRON_SECRET, reject if unset
  const cronError = requireCronSecret(request);
  if (cronError) return cronError;

  try {
    // Find all providers with pending funds
    const providers = await db.provider.findMany({
      where: { pendingPayout: { gt: 0 }, isActive: true },
      select: { id: true, businessName: true, pendingPayout: true },
    });

    let totalCleared = 0;
    let providersCleared = 0;
    const results: { id: string; name: string; cleared: number }[] = [];

    for (const provider of providers) {
      const { cleared } = await clearHeldFunds(provider.id);
      if (cleared > 0) {
        totalCleared += cleared;
        providersCleared++;
        results.push({ id: provider.id, name: provider.businessName, cleared });
      }
    }

    console.log(`[Cron] Hold clearing: $${totalCleared.toFixed(2)} cleared for ${providersCleared} providers`);

    return NextResponse.json({
      success: true,
      providersChecked: providers.length,
      providersCleared,
      totalCleared: Math.round(totalCleared * 100) / 100,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron] Hold clearing failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

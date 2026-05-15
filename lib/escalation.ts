// ── System 2: Time Dilation Escalation Engine ───────────────────────
// Sequential visibility expansion with intelligent pause logic.
//
// Ladder:
//   Tier 0 — Preferred Pro (T+0): Only the customer's preferred provider sees it
//   Tier 1 — Local Zip (T+15min): All active providers in the zip code
//   Tier 2 — Global Broadcast (T+30min): All active providers in surrounding area
//
// Quiet Hours: 9PM–7AM CST — broadcast age doesn't count during this window
// Anti-Gravity Pause: effective_age = real_age - quiet_hours_elapsed

import { db } from '@/lib/db';
import { broadcastJobToProviders } from '@/lib/notifications';

// ── Config ──────────────────────────────────────────────────────────
const ESCALATION_CONFIG = {
  checkIntervalMins: 5,
  quietHours: {
    start: 21, // 9PM
    end: 7,    // 7AM
    timezone: 'America/Chicago',
  },
  ladder: [
    { tier: 0, name: 'Preferred',  delayMins: 0,  scope: 'single_pro_id' },
    { tier: 1, name: 'Local_Zip',  delayMins: 15, scope: 'zip_code_matches' },
    { tier: 2, name: 'Broadcast',  delayMins: 30, scope: 'global_active_pool' },
  ],
};

// ── Check if Current Time is During Quiet Hours ─────────────────────
export function isInQuietHours(now: Date = new Date()): boolean {
  // Convert to CST (America/Chicago)
  const cstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const hour = cstTime.getHours();

  const { start, end } = ESCALATION_CONFIG.quietHours;

  // Quiet hours wrap midnight: 21:00 → 07:00
  if (start > end) {
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}

// ── Calculate Effective Age (excluding quiet hours) ─────────────────
// Real age minus any time spent in quiet hours = effective broadcast age
export function calculateEffectiveAge(broadcastedAt: Date, now: Date = new Date()): number {
  const realAgeMs = now.getTime() - broadcastedAt.getTime();
  const realAgeMins = realAgeMs / (1000 * 60);

  // Walk through each minute since broadcast and subtract quiet-hour minutes
  let quietMinutes = 0;
  const step = new Date(broadcastedAt);

  while (step.getTime() < now.getTime()) {
    if (isInQuietHours(step)) {
      quietMinutes++;
    }
    step.setMinutes(step.getMinutes() + 1);

    // Safety cap: don't loop more than 48 hours
    if (quietMinutes > 2880) break;
  }

  return Math.max(0, realAgeMins - quietMinutes);
}

// ── Escalation Check ────────────────────────────────────────────────
// Called inline when jobs are fetched. Promotes jobs up the visibility ladder.
export async function runEscalationCheck(): Promise<{
  escalated: number;
  details: { jobId: string; fromTier: number; toTier: number }[];
}> {
  const results: { jobId: string; fromTier: number; toTier: number }[] = [];
  const now = new Date();

  // Find all broadcast jobs that might need escalation
  const broadcastJobs = await db.job.findMany({
    where: {
      status: 'broadcast',
      broadcastedAt: { not: null },
      broadcastTier: { lt: 2 }, // Not yet at max tier
    },
  });

  for (const job of broadcastJobs) {
    if (!job.broadcastedAt) continue;

    // Skip escalation during quiet hours
    if (isInQuietHours(now)) continue;

    const effectiveAge = calculateEffectiveAge(job.broadcastedAt, now);
    const currentTier = job.broadcastTier;

    // Determine target tier based on effective age
    let targetTier = currentTier;
    for (const rung of ESCALATION_CONFIG.ladder) {
      if (rung.tier > currentTier && effectiveAge >= rung.delayMins) {
        targetTier = rung.tier;
      }
    }

    // If we need to escalate
    if (targetTier > currentTier) {
      await db.job.update({
        where: { id: job.id },
        data: {
          broadcastTier: targetTier,
          escalatedAt: now,
        },
      });

      // Trigger additional notifications for the new tier
      if (targetTier === 1) {
        // Tier 1: Notify all providers in the zip code
        broadcastJobToProviders(job.id).catch((err) => {
          console.error(`[Escalation] Tier 1 broadcast error for job ${job.id}:`, err);
        });
      } else if (targetTier === 2) {
        // Tier 2: Notify providers in surrounding area (wider radius)
        await broadcastToGlobalPool(job.id, job.zipCode);
      }

      results.push({ jobId: job.id, fromTier: currentTier, toTier: targetTier });
      console.log(`[Escalation] Job ${job.id}: Tier ${currentTier} → Tier ${targetTier} (effective age: ${Math.round(effectiveAge)}min)`);
    }
  }

  return { escalated: results.length, details: results };
}

// ── Tier 2: Global Pool Broadcast ───────────────────────────────────
// Expands visibility beyond the exact zip code to surrounding area providers
async function broadcastToGlobalPool(jobId: string, originalZip: string) {
  try {
    const job = await db.job.findUnique({
      where: { id: jobId },
      include: { customer: true },
    });
    if (!job) return;

    // Find ALL active providers (not just zip-matched)
    const allProviders = await db.provider.findMany({
      where: { isActive: true },
      include: {
        user: { include: { notificationPrefs: true } },
      },
    });

    // Filter to providers NOT already notified (not in the original zip)
    const newProviders = allProviders.filter((p) => {
      try {
        const zips: string[] = JSON.parse(p.zipCodes);
        return !zips.includes(originalZip); // Only notify those NOT already in zip
      } catch {
        return true; // If zip parsing fails, include them
      }
    });

    if (newProviders.length === 0) return;

    console.log(`[Escalation] Tier 2: Broadcasting job ${jobId} to ${newProviders.length} additional providers`);

    for (const provider of newProviders) {
      await db.notification.create({
        data: {
          userId: provider.userId,
          jobId: job.id,
          type: 'job_broadcast',
          channel: 'in_app',
          title: '🔔 Nearby Job Available!',
          body: `${job.serviceType} in ${job.zipCode} — $${job.price.toFixed(2)}. This job needs a pro — boosted payout available!`,
          isSent: true,
          sentAt: new Date(),
          metadata: JSON.stringify({
            jobPrice: job.price,
            serviceType: job.serviceType,
            tier: job.tier,
            zipCode: job.zipCode,
            escalationTier: 2,
          }),
        },
      });
    }
  } catch (error) {
    console.error(`[Escalation] Global broadcast error:`, error);
  }
}

// ── Admin Re-pulse ──────────────────────────────────────────────────
// Manual trigger to re-broadcast a stale job to all providers
export async function repulseJob(jobId: string): Promise<{ success: boolean; providersNotified: number }> {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'broadcast') {
    return { success: false, providersNotified: 0 };
  }

  // Reset broadcast timestamp and tier
  await db.job.update({
    where: { id: jobId },
    data: {
      broadcastedAt: new Date(),
      broadcastTier: 2, // Force to global tier
      escalatedAt: new Date(),
    },
  });

  // Re-broadcast to all providers
  const result = await broadcastJobToProviders(jobId);

  console.log(`[Repulse] Job ${jobId} re-pulsed to ${result.providersNotified} providers`);

  return { success: true, providersNotified: result.providersNotified };
}

export { ESCALATION_CONFIG };

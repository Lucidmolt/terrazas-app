// ── Gig-Tier: Risk-Tiering & Community Pro Engine ───────────────────
// Manages the two-tier provider system:
//   Tier 0 — Community Pro (Side-Hustler): ID + Phone + Stripe, restricted scope
//   Tier 1 — Verified Pro (Professional): Full insurance + license, unlimited
//
// This module handles:
//   1. Job visibility filtering (what each tier can see)
//   2. Complexity detection (AI yard vision integration)
//   3. Equipment-based restrictions
//   4. Escrow hold management for Community Pros
//   5. Upgrade path tracking and eligibility

import { db } from '@/lib/db';

// ── Config ──────────────────────────────────────────────────────────
export const GIG_TIER_CONFIG = {
  community: {
    tier: 0,
    maxLotSqFt: 10890,    // 0.25 acres
    maxJobPrice: 50.00,
    maxActiveJobs: 2,
    allowedServiceTypes: ['mowing'],
    allowedTerrain: ['flat'],
    escrowHoldPercent: 0.05,   // 5% of payout held
    escrowHoldJobCount: 10,    // First 10 jobs only
  },
  verified: {
    tier: 1,
    maxLotSqFt: Infinity,
    maxJobPrice: Infinity,
    maxActiveJobs: Infinity,
    allowedServiceTypes: ['mowing', 'cleanup', 'full_service', 'landscaping', 'hedge_trimming'],
    allowedTerrain: ['flat', 'sloped', 'steep'],
    escrowHoldPercent: 0,
    escrowHoldJobCount: 0,
  },
  upgrade: {
    requiredJobs: 20,
    requiredRating: 4.8,
  },
  // Complexity flags that block Community Pros
  hazardFlags: ['pool', 'steep', 'expensive_landscaping', 'cliff', 'water_feature', 'retaining_wall'],
  // Equipment restrictions
  equipmentLotCaps: {
    push_mower: 13000,     // ~0.3 acres max for push mower
    riding_mower: Infinity,
    commercial: Infinity,
  } as Record<string, number>,
};

// ── Types ───────────────────────────────────────────────────────────
interface ProviderProfile {
  id: string;
  proTier: number;
  equipmentTag: string | null;
  completedJobCount: number;
  rating: number;
  isActive: boolean;
  stripeAccountId: string | null;
  idVerified: boolean;
  insuranceStatus: string;
}

interface JobForFiltering {
  id: string;
  minProTier: number;
  serviceType: string;
  lotSize: string;
  lotSqFt: number | null;
  terrainType: string;
  complexityFlags: string;
  price: number;
  conditionGrade: string | null;
}

// ── Job Visibility Filter ───────────────────────────────────────────
// Determines if a specific provider can see a specific job based on their tier.
export function canProviderSeeJob(provider: ProviderProfile, job: JobForFiltering): {
  visible: boolean;
  reason?: string;
} {
  const config = provider.proTier === 0 ? GIG_TIER_CONFIG.community : GIG_TIER_CONFIG.verified;

  // Check minimum tier requirement on the job itself
  if (provider.proTier < job.minProTier) {
    return { visible: false, reason: 'Job requires a higher-tier provider' };
  }

  // Community Pro restrictions
  if (provider.proTier === 0) {
    // Price cap
    if (job.price > config.maxJobPrice) {
      return { visible: false, reason: `Price $${job.price} exceeds Community Pro cap of $${config.maxJobPrice}` };
    }

    // Service type restriction
    if (!config.allowedServiceTypes.includes(job.serviceType)) {
      return { visible: false, reason: `Service type '${job.serviceType}' not available for Community Pros` };
    }

    // Terrain restriction
    if (!config.allowedTerrain.includes(job.terrainType)) {
      return { visible: false, reason: `Terrain '${job.terrainType}' not available for Community Pros` };
    }

    // Lot size restriction
    const lotSqFt = job.lotSqFt || lotSizeToSqFt(job.lotSize);
    if (lotSqFt > config.maxLotSqFt) {
      return { visible: false, reason: `Lot size ${lotSqFt} sqft exceeds Community Pro cap of ${config.maxLotSqFt} sqft` };
    }

    // Complexity / hazard flags — "Antigravity" push-away
    const flags: string[] = safeParseJSON(job.complexityFlags, []);
    const hasHazard = flags.some(f => GIG_TIER_CONFIG.hazardFlags.includes(f));
    if (hasHazard) {
      return { visible: false, reason: `Job has hazard flags: ${flags.join(', ')}` };
    }

    // AI condition grade restriction
    if (job.conditionGrade === 'neglected' || job.conditionGrade === 'overgrown') {
      return { visible: false, reason: `Yard condition '${job.conditionGrade}' restricted to Verified Pros` };
    }

    // Equipment-based restriction
    if (provider.equipmentTag) {
      const equipmentCap = GIG_TIER_CONFIG.equipmentLotCaps[provider.equipmentTag] || Infinity;
      const lotSqFtVal = job.lotSqFt || lotSizeToSqFt(job.lotSize);
      if (lotSqFtVal > equipmentCap) {
        return { visible: false, reason: `Equipment '${provider.equipmentTag}' can't handle ${lotSqFtVal} sqft` };
      }
    }
  }

  return { visible: true };
}

// ── Filter Jobs for a Provider ──────────────────────────────────────
// Takes a list of jobs and returns only the ones this provider can see.
export function filterJobsForProvider(
  provider: ProviderProfile,
  jobs: JobForFiltering[]
): JobForFiltering[] {
  return jobs.filter(job => canProviderSeeJob(provider, job).visible);
}

// ── Set Job Complexity from AI Vision ───────────────────────────────
// Called after Yard Vision scans a photo. Sets complexity flags and
// auto-restricts the job to Verified Pros if hazards detected.
export async function setJobComplexity(
  jobId: string,
  flags: string[],
  terrain: string,
  lotSqFt?: number
): Promise<{ minProTier: number; restricted: boolean }> {
  const hasHazard = flags.some(f => GIG_TIER_CONFIG.hazardFlags.includes(f));
  const isComplex = terrain !== 'flat' || hasHazard;
  const minProTier = isComplex ? 1 : 0;

  await db.job.update({
    where: { id: jobId },
    data: {
      complexityFlags: JSON.stringify(flags),
      terrainType: terrain,
      lotSqFt: lotSqFt || null,
      minProTier,
    },
  });

  if (isComplex) {
    console.log(`[GigTier] Job ${jobId} restricted to Verified Pros: flags=${flags.join(',')}, terrain=${terrain}`);
  }

  return { minProTier, restricted: isComplex };
}

// ── Escrow Hold Calculation ─────────────────────────────────────────
// Calculates and records the escrow hold for a Community Pro payout.
export async function calculateEscrowHold(
  providerId: string,
  jobId: string,
  payoutAmount: number
): Promise<{ holdAmount: number; netPayout: number }> {
  const provider = await db.provider.findUnique({ where: { id: providerId } });
  if (!provider) return { holdAmount: 0, netPayout: payoutAmount };

  // No hold for Verified Pros
  if (provider.proTier >= 1) return { holdAmount: 0, netPayout: payoutAmount };

  // No hold after first N jobs
  if (provider.completedJobCount >= GIG_TIER_CONFIG.community.escrowHoldJobCount) {
    return { holdAmount: 0, netPayout: payoutAmount };
  }

  // Calculate hold
  const holdAmount = Math.round(payoutAmount * provider.escrowHoldPct * 100) / 100;
  const netPayout = payoutAmount - holdAmount;

  // Record the escrow hold
  await db.escrowHold.create({
    data: {
      providerId,
      jobId,
      amount: holdAmount,
      status: 'held',
    },
  });

  // Update provider's escrow balance
  await db.provider.update({
    where: { id: providerId },
    data: { escrowBalance: { increment: holdAmount } },
  });

  console.log(`[GigTier] Escrow hold: $${holdAmount} from provider ${providerId} (job ${jobId})`);

  return { holdAmount, netPayout };
}

// ── Release Escrow ──────────────────────────────────────────────────
// Releases all held escrow back to a provider (after clean track record).
export async function releaseEscrow(providerId: string): Promise<{ released: number }> {
  const holds = await db.escrowHold.findMany({
    where: { providerId, status: 'held' },
  });

  if (holds.length === 0) return { released: 0 };

  const totalReleased = holds.reduce((sum, h) => sum + h.amount, 0);

  await db.escrowHold.updateMany({
    where: { providerId, status: 'held' },
    data: { status: 'released', releasedAt: new Date() },
  });

  await db.provider.update({
    where: { id: providerId },
    data: {
      escrowBalance: 0,
      pendingPayout: { increment: totalReleased },
    },
  });

  console.log(`[GigTier] Released $${totalReleased} escrow for provider ${providerId}`);

  return { released: totalReleased };
}

// ── Upgrade Eligibility Check ───────────────────────────────────────
// Checks if a Community Pro qualifies for upgrade to Verified Pro.
// Called after every job completion.
export async function checkUpgradeEligibility(providerId: string): Promise<{
  eligible: boolean;
  completedJobs: number;
  rating: number;
}> {
  const provider = await db.provider.findUnique({ where: { id: providerId } });
  if (!provider || provider.proTier >= 1) {
    return { eligible: false, completedJobs: provider?.completedJobCount || 0, rating: provider?.rating || 0 };
  }

  const meetsJobs = provider.completedJobCount >= GIG_TIER_CONFIG.upgrade.requiredJobs;
  const meetsRating = provider.rating >= GIG_TIER_CONFIG.upgrade.requiredRating;
  const eligible = meetsJobs && meetsRating;

  if (eligible && !provider.upgradeEligible) {
    await db.provider.update({
      where: { id: providerId },
      data: {
        upgradeEligible: true,
        upgradeOfferedAt: new Date(),
      },
    });

    // Create upgrade notification
    await db.notification.create({
      data: {
        userId: provider.userId,
        type: 'system',
        channel: 'in_app',
        title: '🎉 You qualify for Verified Pro!',
        body: `You've completed ${provider.completedJobCount} jobs with a ${provider.rating.toFixed(1)}★ rating! Upgrade to Verified Pro for access to premium jobs, higher payouts, and the Terrazas Pro-Pack discount on General Liability insurance.`,
        isSent: true,
        sentAt: new Date(),
      },
    });

    console.log(`[GigTier] Provider ${providerId} is upgrade-eligible! Jobs: ${provider.completedJobCount}, Rating: ${provider.rating}`);
  }

  return {
    eligible,
    completedJobs: provider.completedJobCount,
    rating: provider.rating,
  };
}

// ── Increment Completed Jobs ────────────────────────────────────────
// Called when a job is marked completed. Updates count + checks upgrade.
export async function onJobCompleted(providerId: string, jobId: string): Promise<void> {
  await db.provider.update({
    where: { id: providerId },
    data: { completedJobCount: { increment: 1 } },
  });

  // Check upgrade eligibility after every completion
  await checkUpgradeEligibility(providerId);
}

// ── Active Job Count Check ──────────────────────────────────────────
// Verifies a Community Pro hasn't exceeded their active job cap.
export async function canAcceptMoreJobs(providerId: string): Promise<{
  canAccept: boolean;
  activeCount: number;
  maxAllowed: number;
}> {
  const provider = await db.provider.findUnique({ where: { id: providerId } });
  if (!provider) return { canAccept: false, activeCount: 0, maxAllowed: 0 };

  const config = provider.proTier === 0 ? GIG_TIER_CONFIG.community : GIG_TIER_CONFIG.verified;

  if (config.maxActiveJobs === Infinity) {
    return { canAccept: true, activeCount: 0, maxAllowed: Infinity };
  }

  const activeCount = await db.job.count({
    where: {
      providerId,
      status: { in: ['active', 'en_route', 'in_progress', 'pending_approval'] },
    },
  });

  return {
    canAccept: activeCount < config.maxActiveJobs,
    activeCount,
    maxAllowed: config.maxActiveJobs,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────
function lotSizeToSqFt(lotSize: string): number {
  const map: Record<string, number> = {
    small: 5000,
    medium: 8000,
    large: 15000,
    xl: 25000,
  };
  return map[lotSize] || 8000;
}

function safeParseJSON<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

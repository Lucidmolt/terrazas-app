// ── Terrazas Dynamic Pricing Engine ─────────────────────────────────
// PRICE = BASE × SCOPE × CONDITION × DEMAND × URGENCY + EXTRAS
//
// Every multiplier is transparent to the customer.

import { db } from '@/lib/db';
import { TIERS } from '@/lib/constants';

// ── Multiplier Definitions ─────────────────────────────────────────

export const SCOPE_MULTIPLIERS = {
  front_only:  0.6,
  back_only:   0.7,
  front_back:  1.0,
  full_property: 1.2, // front + back + side yards
} as const;

export const CONDITION_MULTIPLIERS: Record<string, { multiplier: number; label: string }> = {
  pristine:  { multiplier: 0.85, label: 'Pristine — recently maintained' },
  good:      { multiplier: 0.95, label: 'Good — minor growth' },
  average:   { multiplier: 1.0,  label: 'Average — needs mowing' },
  overgrown: { multiplier: 1.25, label: 'Overgrown — 2-3 weeks growth' },
  neglected: { multiplier: 1.5,  label: 'Neglected — heavy clearing needed' },
};

export const LOT_SIZE_MULTIPLIERS = {
  small:  { multiplier: 0.8,  label: 'Small lot (< 0.15 acre)' },
  medium: { multiplier: 1.0,  label: 'Standard lot (0.15–0.3 acre)' },
  large:  { multiplier: 1.3,  label: 'Large lot (0.3–0.5 acre)' },
  xl:     { multiplier: 1.6,  label: 'XL lot (> 0.5 acre)' },
} as const;

export const URGENCY_MULTIPLIERS = {
  scheduled: { multiplier: 0.9,  label: 'Scheduled (2+ days out)' },
  same_day:  { multiplier: 1.0,  label: 'Same day' },
  asap:      { multiplier: 1.2,  label: 'ASAP (within 2 hours)' },
} as const;

export const EXTRAS_PRICING: Record<string, { cost: number; label: string }> = {
  dog_waste:     { cost: 15, label: 'Dog waste cleanup' },
  steep_slope:   { cost: 10, label: 'Steep slope' },
  bag_clippings: { cost: 10, label: 'Bag clippings (vs mulch)' },
  heavy_debris:  { cost: 15, label: 'Heavy debris/leaves' },
  light_debris:  { cost: 8,  label: 'Light debris cleanup' },
};

// ── Price Guardrails ───────────────────────────────────────────────

const MIN_JOB_PRICE = 25;
const MAX_JOB_PRICE = 300;
const MAX_SURGE = 1.5;
const MIN_SURGE = 0.9;

// ── Platform Fees ──────────────────────────────────────────────────

const SERVICE_FEE_PERCENT = 0.13;
const PROCESSING_FEE = 2.50;
const MIN_SERVICE_FEE = 5.00;
const PROVIDER_COMMISSION = 0.10;

// ── Types ──────────────────────────────────────────────────────────

export interface PricingInput {
  tier: 'basic' | 'premium';
  scope: keyof typeof SCOPE_MULTIPLIERS;
  conditionScore?: number;     // 1-10 from AI vision
  lotSize?: keyof typeof LOT_SIZE_MULTIPLIERS;
  urgency?: keyof typeof URGENCY_MULTIPLIERS;
  extras?: string[];           // keys from EXTRAS_PRICING
  zipCode?: string;            // for demand calculation
  tipAmount?: number;
}

export interface PricingBreakdown {
  // Base
  basePrice: number;
  tier: string;

  // Multipliers (each shown to customer)
  scopeMultiplier: number;
  scopeLabel: string;
  conditionMultiplier: number;
  conditionLabel: string;
  demandMultiplier: number;
  demandLabel: string;
  lotSizeMultiplier: number;
  lotSizeLabel: string;
  urgencyMultiplier: number;
  urgencyLabel: string;

  // Extras
  extrasTotal: number;
  extrasBreakdown: { key: string; label: string; cost: number }[];

  // Calculated
  jobPrice: number;          // after all multipliers + extras
  serviceFee: number;
  processingFee: number;
  tipAmount: number;
  customerTotal: number;
  providerPayout: number;
  platformRevenue: number;

  // Meta
  surgeLevel: 'low' | 'normal' | 'busy' | 'high' | 'peak';
  conditionGrade: string;
  priceWasCapped: boolean;
}

// ── Condition Score → Multiplier ───────────────────────────────────

function conditionFromScore(score: number): { multiplier: number; label: string; grade: string } {
  if (score >= 9) return { ...CONDITION_MULTIPLIERS.pristine, grade: 'pristine' };
  if (score >= 7) return { ...CONDITION_MULTIPLIERS.good, grade: 'good' };
  if (score >= 5) return { ...CONDITION_MULTIPLIERS.average, grade: 'average' };
  if (score >= 3) return { ...CONDITION_MULTIPLIERS.overgrown, grade: 'overgrown' };
  return { ...CONDITION_MULTIPLIERS.neglected, grade: 'neglected' };
}

// ── Demand Surge Calculator ────────────────────────────────────────

async function calculateDemandMultiplier(zipCode?: string): Promise<{
  multiplier: number;
  label: string;
  level: 'low' | 'normal' | 'busy' | 'high' | 'peak';
  ratio: number;
}> {
  if (!zipCode) {
    return { multiplier: 1.0, label: '', level: 'normal', ratio: 1.0 };
  }

  try {
    // Count open jobs in this area
    const openJobs = await db.job.count({
      where: {
        zipCode,
        status: { in: ['broadcast', 'pending_claim'] },
        createdAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) }, // last 4 hours
      },
    });

    // Count active providers in this area
    const allProviders = await db.provider.findMany({
      where: { isActive: true },
      select: { zipCodes: true },
    });

    const availableProviders = allProviders.filter((p) => {
      try {
        const zips: string[] = JSON.parse(p.zipCodes);
        return zips.includes(zipCode);
      } catch {
        return false;
      }
    }).length;

    // Avoid division by zero
    const ratio = availableProviders > 0 ? openJobs / availableProviders : openJobs > 0 ? 3.5 : 0.5;

    // Determine surge level
    if (ratio < 0.5) {
      return { multiplier: MIN_SURGE, label: '🟢 Low demand — prices reduced!', level: 'low', ratio };
    }
    if (ratio <= 1.0) {
      return { multiplier: 1.0, label: '', level: 'normal', ratio };
    }
    if (ratio <= 2.0) {
      const m = Math.min(1.15, 1.0 + (ratio - 1.0) * 0.15);
      return { multiplier: m, label: '🟡 Busy right now', level: 'busy', ratio };
    }
    if (ratio <= 3.0) {
      const m = Math.min(1.3, 1.15 + (ratio - 2.0) * 0.15);
      return { multiplier: m, label: '🟠 High demand — premium pricing', level: 'high', ratio };
    }
    return { multiplier: MAX_SURGE, label: '🔴 Peak demand — max surge', level: 'peak', ratio };
  } catch (err) {
    console.error('Demand calc error:', err);
    return { multiplier: 1.0, label: '', level: 'normal', ratio: 1.0 };
  }
}

// ── Day/Time Modifier ──────────────────────────────────────────────
// Slight adjustments based on when the job is posted

function getTimeModifier(): number {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 6=Sat

  let modifier = 1.0;

  // Weekend premium (Sat/Sun)
  if (day === 0 || day === 6) modifier += 0.05;

  // Peak afternoon hours (2pm-5pm)
  if (hour >= 14 && hour <= 17) modifier += 0.03;

  // Early bird discount (7am-9am)
  if (hour >= 7 && hour <= 9) modifier -= 0.03;

  return modifier;
}

// ── Main Pricing Function ──────────────────────────────────────────

export async function calculateDynamicPrice(input: PricingInput): Promise<PricingBreakdown> {
  // 1. Base price from tier
  const tierData = TIERS[input.tier] || TIERS.basic;
  const basePrice = tierData.basePrice;

  // 2. Scope multiplier
  const scopeMultiplier = SCOPE_MULTIPLIERS[input.scope] || 1.0;
  const scopeLabel = {
    front_only: 'Front yard only',
    back_only: 'Back yard only',
    front_back: 'Front + back yard',
    full_property: 'Full property',
  }[input.scope] || 'Standard';

  // 3. Condition multiplier (from AI score)
  const condition = input.conditionScore
    ? conditionFromScore(input.conditionScore)
    : { multiplier: 1.0, label: 'Not assessed', grade: 'average' };

  // 4. Demand multiplier
  const demand = await calculateDemandMultiplier(input.zipCode);

  // 5. Lot size multiplier
  const lotSize = input.lotSize
    ? LOT_SIZE_MULTIPLIERS[input.lotSize]
    : LOT_SIZE_MULTIPLIERS.medium;
  const lotSizeLabel = lotSize.label;

  // 6. Urgency multiplier
  const urgency = input.urgency
    ? URGENCY_MULTIPLIERS[input.urgency]
    : URGENCY_MULTIPLIERS.same_day;

  // 7. Time modifier (subtle)
  const timeMod = getTimeModifier();

  // 8. Extras
  const extrasBreakdown = (input.extras || [])
    .filter((key) => EXTRAS_PRICING[key])
    .map((key) => ({
      key,
      label: EXTRAS_PRICING[key].label,
      cost: EXTRAS_PRICING[key].cost,
    }));
  const extrasTotal = extrasBreakdown.reduce((sum, e) => sum + e.cost, 0);

  // ── Calculate job price ──
  let jobPrice = basePrice
    * scopeMultiplier
    * condition.multiplier
    * demand.multiplier
    * lotSize.multiplier
    * urgency.multiplier
    * timeMod
    + extrasTotal;

  // Apply guardrails
  let priceWasCapped = false;
  if (jobPrice < MIN_JOB_PRICE) {
    jobPrice = MIN_JOB_PRICE;
    priceWasCapped = true;
  }
  if (jobPrice > MAX_JOB_PRICE) {
    jobPrice = MAX_JOB_PRICE;
    priceWasCapped = true;
  }

  jobPrice = Math.round(jobPrice * 100) / 100;

  // ── Platform fees ──
  const serviceFee = Math.max(
    Math.round(jobPrice * SERVICE_FEE_PERCENT * 100) / 100,
    MIN_SERVICE_FEE
  );
  const processingFee = PROCESSING_FEE;
  const tipAmount = input.tipAmount || 0;

  const customerTotal = Math.round((jobPrice + serviceFee + processingFee + tipAmount) * 100) / 100;
  const providerPayout = Math.round((jobPrice * (1 - PROVIDER_COMMISSION) + tipAmount) * 100) / 100;
  const platformRevenue = Math.round((serviceFee + processingFee + jobPrice * PROVIDER_COMMISSION) * 100) / 100;

  return {
    basePrice,
    tier: input.tier,
    scopeMultiplier,
    scopeLabel,
    conditionMultiplier: condition.multiplier,
    conditionLabel: condition.label,
    demandMultiplier: demand.multiplier,
    demandLabel: demand.label,
    lotSizeMultiplier: lotSize.multiplier,
    lotSizeLabel,
    urgencyMultiplier: urgency.multiplier,
    urgencyLabel: urgency.label,
    extrasTotal,
    extrasBreakdown,
    jobPrice,
    serviceFee,
    processingFee,
    tipAmount,
    customerTotal,
    providerPayout,
    platformRevenue,
    surgeLevel: demand.level,
    conditionGrade: condition.grade,
    priceWasCapped,
  };
}

// ── Quick Preview (no DB call, no demand) ──────────────────────────
// For real-time UI updates as customer changes options

export function previewPrice(input: Omit<PricingInput, 'zipCode'>): Omit<PricingBreakdown, 'demandMultiplier' | 'demandLabel' | 'surgeLevel'> & { demandMultiplier: number; demandLabel: string; surgeLevel: string } {
  const tierData = TIERS[input.tier] || TIERS.basic;
  const basePrice = tierData.basePrice;

  const scopeMultiplier = SCOPE_MULTIPLIERS[input.scope] || 1.0;
  const scopeLabel = {
    front_only: 'Front yard only',
    back_only: 'Back yard only',
    front_back: 'Front + back yard',
    full_property: 'Full property',
  }[input.scope] || 'Standard';

  const condition = input.conditionScore
    ? conditionFromScore(input.conditionScore)
    : { multiplier: 1.0, label: 'Not assessed', grade: 'average' };

  const lotSize = input.lotSize
    ? LOT_SIZE_MULTIPLIERS[input.lotSize]
    : LOT_SIZE_MULTIPLIERS.medium;

  const urgency = input.urgency
    ? URGENCY_MULTIPLIERS[input.urgency]
    : URGENCY_MULTIPLIERS.same_day;

  const extrasBreakdown = (input.extras || [])
    .filter((key) => EXTRAS_PRICING[key])
    .map((key) => ({ key, label: EXTRAS_PRICING[key].label, cost: EXTRAS_PRICING[key].cost }));
  const extrasTotal = extrasBreakdown.reduce((sum, e) => sum + e.cost, 0);

  let jobPrice = basePrice * scopeMultiplier * condition.multiplier * lotSize.multiplier * urgency.multiplier + extrasTotal;
  const priceWasCapped = jobPrice < MIN_JOB_PRICE || jobPrice > MAX_JOB_PRICE;
  jobPrice = Math.max(MIN_JOB_PRICE, Math.min(MAX_JOB_PRICE, jobPrice));
  jobPrice = Math.round(jobPrice * 100) / 100;

  const serviceFee = Math.max(Math.round(jobPrice * SERVICE_FEE_PERCENT * 100) / 100, MIN_SERVICE_FEE);
  const tipAmount = input.tipAmount || 0;
  const customerTotal = Math.round((jobPrice + serviceFee + PROCESSING_FEE + tipAmount) * 100) / 100;
  const providerPayout = Math.round((jobPrice * (1 - PROVIDER_COMMISSION) + tipAmount) * 100) / 100;
  const platformRevenue = Math.round((serviceFee + PROCESSING_FEE + jobPrice * PROVIDER_COMMISSION) * 100) / 100;

  return {
    basePrice, tier: input.tier,
    scopeMultiplier, scopeLabel,
    conditionMultiplier: condition.multiplier, conditionLabel: condition.label,
    demandMultiplier: 1.0, demandLabel: 'Calculated at checkout',
    lotSizeMultiplier: lotSize.multiplier, lotSizeLabel: lotSize.label,
    urgencyMultiplier: urgency.multiplier, urgencyLabel: urgency.label,
    extrasTotal, extrasBreakdown,
    jobPrice, serviceFee, processingFee: PROCESSING_FEE, tipAmount,
    customerTotal, providerPayout, platformRevenue,
    surgeLevel: 'normal', conditionGrade: condition.grade, priceWasCapped,
  };
}

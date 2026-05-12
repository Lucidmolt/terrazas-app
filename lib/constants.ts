// ── Terrazas.app Constants ──────────────────────────────────────────

export const TIERS = {
  basic: {
    id: 'basic',
    name: 'Basic',
    emoji: '🌱',
    description: 'Standard mow & blow',
    includes: ['Mow', 'Blow off walkways'],
    basePrice: 45,
    etaLabel: '8 MIN ETA',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    emoji: '🌿',
    description: 'Full service with edging & bagging',
    includes: ['Mow', 'Edge all borders', 'String trim', 'Bag clippings', 'Blow off'],
    basePrice: 75,
    etaLabel: '12 MIN ETA',
  },
} as const;

export const SERVICE_TYPES = {
  mowing: { label: 'Standard Mow', emoji: '🌱', startingPrice: 45 },
  cleanup: { label: 'Lawn Cleanup', emoji: '🧹', startingPrice: 65 },
  edge_trim: { label: 'Edge & Trim', emoji: '✂️', startingPrice: 35 },
  leaf_removal: { label: 'Leaf Removal', emoji: '🍂', startingPrice: 55 },
  full_service: { label: 'Full Service', emoji: '🏡', startingPrice: 120 },
} as const;

export const JOB_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  broadcast: { label: 'Broadcasting', color: 'text-blue-600 bg-blue-50' },
  pending_claim: { label: 'Pending Claim', color: 'text-amber-600 bg-amber-50' },
  active: { label: 'Claimed', color: 'text-emerald-600 bg-emerald-50' },
  en_route: { label: 'Pro En Route', color: 'text-emerald-600 bg-emerald-50' },
  in_progress: { label: 'In Progress', color: 'text-emerald-700 bg-emerald-100' },
  completed: { label: 'Completed', color: 'text-slate-600 bg-slate-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-600 bg-red-50' },
};

export const TIP_PRESETS = [5, 10, 15, 20, 25] as const;

export const BROADCAST_WINDOW_SECONDS = 15 * 60; // 15 minutes
export const CLAIM_RADIUS_MILES = 120; // Liberal, KS launch zone

// ── Platform Fee Structure ──────────────────────────────────────────
// This is how Terrazas.app generates revenue.
// Customer pays: job price + service fee + processing fee
// Provider receives: job price (minus platform commission)
export const FEES = {
  // Platform service fee — percentage charged to customer on top of job price
  SERVICE_FEE_PERCENT: 0.15, // 15%
  // Fixed processing fee per transaction (covers Stripe fees + margin)
  PROCESSING_FEE: 2.50,
  // Minimum service fee (floor)
  MIN_SERVICE_FEE: 5.00,
  // Provider commission — percentage Terrazas keeps from the provider's payout
  PROVIDER_COMMISSION_PERCENT: 0.10, // 10%
} as const;

// Helper: calculate full price breakdown for a job
export function calculatePricing(jobPrice: number, tipAmount: number = 0) {
  const serviceFee = Math.max(
    jobPrice * FEES.SERVICE_FEE_PERCENT,
    FEES.MIN_SERVICE_FEE
  );
  const processingFee = FEES.PROCESSING_FEE;
  const customerTotal = jobPrice + serviceFee + processingFee + tipAmount;
  const platformRevenue = serviceFee + processingFee + (jobPrice * FEES.PROVIDER_COMMISSION_PERCENT);
  const providerPayout = jobPrice * (1 - FEES.PROVIDER_COMMISSION_PERCENT) + tipAmount;

  return {
    jobPrice:       Math.round(jobPrice * 100) / 100,
    serviceFee:     Math.round(serviceFee * 100) / 100,
    processingFee,
    tipAmount:      Math.round(tipAmount * 100) / 100,
    customerTotal:  Math.round(customerTotal * 100) / 100,
    providerPayout: Math.round(providerPayout * 100) / 100,
    platformRevenue: Math.round(platformRevenue * 100) / 100,
  };
}

// ── Launch Zone: Liberal, KS ────────────────────────────────────────
// 120-mile radius covers SW Kansas, OK panhandle, TX panhandle, SE Colorado
export const LAUNCH_ZONE = {
  center: { lat: 37.0439, lng: -100.9210 },
  radiusMiles: 120,
  name: 'Southwest Kansas',
  defaultZip: '67901', // Liberal, KS
  // Key towns in the zone
  coverage: [
    'Liberal', 'Garden City', 'Dodge City', 'Hugoton', 'Satanta',
    'Meade', 'Sublette', 'Ulysses', 'Johnson', 'Elkhart',
    'Guymon', 'Boise City', // OK panhandle
    'Perryton', 'Borger', 'Pampa', // TX panhandle
    'Lamar', 'Springfield', // SE Colorado
  ],
} as const;

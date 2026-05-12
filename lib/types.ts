// ── Terrazas.app Type Definitions ──────────────────────────────────
// Derived from the Prisma schema but used across the app layer.

export type UserRole = 'customer' | 'provider';

export type JobStatus =
  | 'broadcast'
  | 'pending_claim'
  | 'active'
  | 'en_route'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type ServiceTier = 'basic' | 'premium';

export type ServiceType =
  | 'mowing'
  | 'cleanup'
  | 'edge_trim'
  | 'leaf_removal'
  | 'full_service';

export type InsuranceStatus = 'pending' | 'verified' | 'flagged';

export type TipStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type AIProvider = 'local' | 'cloud';

export type EffortLevel = 'low' | 'medium' | 'high' | 'extreme';

// ── Yard Vision AI Response ────────────────────────────────────────
export interface YardScanResult {
  conditionScore: number;     // 1-10
  estimatedEffort: EffortLevel;
  findings: string[];         // Array of detected issues
  recommendation: string;     // Summary recommendation
  priceAdjustment: number;    // Suggested price modifier ($)
  warning: boolean;           // Should flag the job?
}

// ── Stripe Placeholder Types ───────────────────────────────────────
export interface StripePaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

export interface StripeAccountResult {
  success: boolean;
  accountId?: string;
  onboardingUrl?: string;
  error?: string;
}

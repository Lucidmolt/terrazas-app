// ── Stripe Service Layer ────────────────────────────────────────────
// All Stripe integration points wired and typed.
// Currently operates in "mock mode" — returns realistic mock responses.
// When you create a Stripe account, install `stripe` package and
// uncomment the real implementations.
//
// npm install stripe
// Then set STRIPE_SECRET_KEY in .env.local

import type { StripePaymentResult, StripeAccountResult } from './types';

const STRIPE_CONFIGURED = !!process.env.STRIPE_SECRET_KEY;

// ── Tip Payment ────────────────────────────────────────────────────
// Creates a PaymentIntent for a customer tip to a provider.
export async function createTipPayment(
  amount: number,
  providerStripeAccountId?: string | null
): Promise<StripePaymentResult> {
  if (!STRIPE_CONFIGURED) {
    // Mock mode — simulate successful payment
    console.log(`[Stripe Mock] Tip payment: $${amount} → ${providerStripeAccountId || 'no account'}`);
    return {
      success: true,
      paymentIntentId: `mock_pi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  // ── REAL IMPLEMENTATION (uncomment when Stripe is configured) ────
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  //
  // try {
  //   const paymentIntent = await stripe.paymentIntents.create({
  //     amount: Math.round(amount * 100), // Convert to cents
  //     currency: 'usd',
  //     // Transfer to provider's connected account
  //     ...(providerStripeAccountId && {
  //       transfer_data: {
  //         destination: providerStripeAccountId,
  //       },
  //     }),
  //     metadata: { type: 'tip' },
  //   });
  //
  //   return {
  //     success: true,
  //     paymentIntentId: paymentIntent.id,
  //   };
  // } catch (error: any) {
  //   return { success: false, error: error.message };
  // }

  return { success: true, paymentIntentId: 'mock_not_configured' };
}

// ── Job Payment ────────────────────────────────────────────────────
// Creates a PaymentIntent for the base job price.
export async function createJobPayment(
  amount: number,
  providerStripeAccountId?: string | null
): Promise<StripePaymentResult> {
  if (!STRIPE_CONFIGURED) {
    console.log(`[Stripe Mock] Job payment: $${amount}`);
    return {
      success: true,
      paymentIntentId: `mock_pi_job_${Date.now()}`,
    };
  }

  // Real implementation same pattern as above
  return { success: true, paymentIntentId: 'mock_not_configured' };
}

// ── Provider Onboarding (Connect) ──────────────────────────────────
// Creates a Stripe Connect account for a new provider and returns
// the onboarding URL they need to visit.
export async function createProviderAccount(
  email: string,
  businessName: string
): Promise<StripeAccountResult> {
  if (!STRIPE_CONFIGURED) {
    console.log(`[Stripe Mock] Connect account for: ${businessName} (${email})`);
    return {
      success: true,
      accountId: `mock_acct_${Date.now()}`,
      onboardingUrl: '/pro?stripe_onboarded=mock',
    };
  }

  // ── REAL IMPLEMENTATION ──────────────────────────────────────────
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  //
  // try {
  //   const account = await stripe.accounts.create({
  //     type: 'express',
  //     email,
  //     business_profile: { name: businessName },
  //     capabilities: {
  //       transfers: { requested: true },
  //     },
  //   });
  //
  //   const accountLink = await stripe.accountLinks.create({
  //     account: account.id,
  //     refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/pro/settings`,
  //     return_url: `${process.env.NEXT_PUBLIC_APP_URL}/pro?stripe_onboarded=true`,
  //     type: 'account_onboarding',
  //   });
  //
  //   return {
  //     success: true,
  //     accountId: account.id,
  //     onboardingUrl: accountLink.url,
  //   };
  // } catch (error: any) {
  //   return { success: false, error: error.message };
  // }

  return { success: true, accountId: 'mock_not_configured' };
}

// ── Payout to Provider ─────────────────────────────────────────────
// Initiates a payout to a provider's connected Stripe account.
export async function createPayout(
  providerStripeAccountId: string,
  amount: number
): Promise<StripePaymentResult> {
  if (!STRIPE_CONFIGURED) {
    console.log(`[Stripe Mock] Payout: $${amount} → ${providerStripeAccountId}`);
    return {
      success: true,
      paymentIntentId: `mock_payout_${Date.now()}`,
    };
  }

  return { success: true, paymentIntentId: 'mock_not_configured' };
}

// ── Check if Stripe is Live ────────────────────────────────────────
export function isStripeConfigured(): boolean {
  return STRIPE_CONFIGURED;
}

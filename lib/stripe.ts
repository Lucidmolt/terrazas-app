// ── Stripe Payment Integration ──────────────────────────────────────
// Handles payment processing for Terrazas.app
//
// Flow:
//   1. Customer posts job → createPaymentIntent (holds funds)
//   2. Provider claims & completes → capturePayment (charges customer)
//   3. Platform keeps fees → transferToProvider (pays provider minus commission)
//
// Set STRIPE_SECRET_KEY in .env.local to enable real payments.
// Without it, all functions return mock responses for testing.

import { calculatePricing } from '@/lib/constants';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_CONFIGURED = !!STRIPE_SECRET_KEY;

let stripe: any = null;

async function getStripe() {
  if (!STRIPE_CONFIGURED) return null;
  if (!stripe) {
    const Stripe = (await import('stripe')).default;
    stripe = new Stripe(STRIPE_SECRET_KEY);
  }
  return stripe;
}

// ── Types ──────────────────────────────────────────────────────────
export interface PaymentBreakdown {
  jobPrice: number;
  serviceFee: number;
  processingFee: number;
  tipAmount: number;
  customerTotal: number;
  providerPayout: number;
  platformRevenue: number;
}

export interface PaymentIntentResult {
  clientSecret: string | null;
  paymentIntentId: string;
  breakdown: PaymentBreakdown;
  mode: 'live' | 'mock';
}

// ── Create Payment Intent (when customer posts a job) ──────────────
// This authorizes the customer's card but doesn't charge yet.
export async function createJobPaymentIntent(
  jobPrice: number,
  tipAmount: number = 0,
  customerEmail: string,
  jobId: string
): Promise<PaymentIntentResult> {
  const breakdown = calculatePricing(jobPrice, tipAmount);

  const s = await getStripe();
  if (!s) {
    // Mock mode
    return {
      clientSecret: null,
      paymentIntentId: `mock_pi_${Date.now()}`,
      breakdown,
      mode: 'mock',
    };
  }

  const paymentIntent = await s.paymentIntents.create({
    amount: Math.round(breakdown.customerTotal * 100), // Stripe uses cents
    currency: 'usd',
    capture_method: 'manual', // Authorize only — capture after job completion
    receipt_email: customerEmail,
    metadata: {
      jobId,
      jobPrice: breakdown.jobPrice.toString(),
      serviceFee: breakdown.serviceFee.toString(),
      processingFee: breakdown.processingFee.toString(),
      tipAmount: breakdown.tipAmount.toString(),
      providerPayout: breakdown.providerPayout.toString(),
      platformRevenue: breakdown.platformRevenue.toString(),
    },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    breakdown,
    mode: 'live',
  };
}

// ── Capture Payment (when job is completed) ────────────────────────
// Called after provider marks job complete. Actually charges the customer.
export async function captureJobPayment(paymentIntentId: string): Promise<{
  success: boolean;
  error?: string;
  mode: 'live' | 'mock';
}> {
  if (paymentIntentId.startsWith('mock_')) {
    return { success: true, mode: 'mock' };
  }

  const s = await getStripe();
  if (!s) return { success: true, mode: 'mock' };

  try {
    await s.paymentIntents.capture(paymentIntentId);
    return { success: true, mode: 'live' };
  } catch (error: any) {
    return { success: false, error: error.message, mode: 'live' };
  }
}

// ── Refund Payment (if job is cancelled) ───────────────────────────
export async function refundJobPayment(paymentIntentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (paymentIntentId.startsWith('mock_')) {
    return { success: true };
  }

  const s = await getStripe();
  if (!s) return { success: true };

  try {
    await s.paymentIntents.cancel(paymentIntentId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── Create Stripe Connect Account (for provider payouts) ───────────
// Each provider needs a Stripe Connect account to receive payouts.
export async function createProviderConnectAccount(
  email: string,
  businessName: string
): Promise<{ accountId: string; onboardingUrl: string; mode: 'live' | 'mock' }> {
  const s = await getStripe();
  if (!s) {
    return {
      accountId: `mock_acct_${Date.now()}`,
      onboardingUrl: '/pro?stripe=mock',
      mode: 'mock',
    };
  }

  const account = await s.accounts.create({
    type: 'express',
    email,
    business_type: 'individual',
    business_profile: {
      name: businessName,
      mcc: '0780', // Landscaping services
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  const accountLink = await s.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://terrazas.app'}/pro?stripe=refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://terrazas.app'}/pro?stripe=complete`,
    type: 'account_onboarding',
  });

  return {
    accountId: account.id,
    onboardingUrl: accountLink.url,
    mode: 'live',
  };
}

// ── Transfer to Provider (after job completion) ────────────────────
export async function transferToProvider(
  paymentIntentId: string,
  providerStripeAccountId: string,
  providerPayout: number
): Promise<{ success: boolean; transferId?: string; error?: string }> {
  if (paymentIntentId.startsWith('mock_') || providerStripeAccountId.startsWith('mock_')) {
    return { success: true, transferId: `mock_tr_${Date.now()}` };
  }

  const s = await getStripe();
  if (!s) return { success: true, transferId: `mock_tr_${Date.now()}` };

  try {
    const transfer = await s.transfers.create({
      amount: Math.round(providerPayout * 100),
      currency: 'usd',
      destination: providerStripeAccountId,
      metadata: { paymentIntentId },
    });

    return { success: true, transferId: transfer.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── Get Price Breakdown (for display) ──────────────────────────────
export function getPriceBreakdown(jobPrice: number, tipAmount: number = 0): PaymentBreakdown {
  return calculatePricing(jobPrice, tipAmount);
}

// ── Check Stripe Status ────────────────────────────────────────────
export function isStripeConfigured(): boolean {
  return STRIPE_CONFIGURED;
}

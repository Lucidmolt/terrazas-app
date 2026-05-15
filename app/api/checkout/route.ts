import { NextResponse } from 'next/server';
import { createJobPaymentIntent, captureJobPayment, getPriceBreakdown, isStripeConfigured } from '@/lib/stripe';
import { requireAuth } from '@/lib/api-auth';

// POST /api/checkout — create payment intent for a job
export async function POST(request: Request) {
  // C1 FIX: Require authentication
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { jobId, jobPrice, tipAmount = 0 } = await request.json();

    if (!jobId || !jobPrice) {
      return NextResponse.json(
        { error: 'Missing required fields: jobId, jobPrice' },
        { status: 400 }
      );
    }

    // Use authenticated user's email
    const customerEmail = user!.email!;

    const result = await createJobPaymentIntent(jobPrice, tipAmount, customerEmail, jobId);

    return NextResponse.json({
      ...result,
      stripeConfigured: isStripeConfigured(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/checkout?jobPrice=75&tip=10 — preview price breakdown (public, read-only)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobPrice = parseFloat(searchParams.get('jobPrice') || '75');
  const tip = parseFloat(searchParams.get('tip') || '0');

  const breakdown = getPriceBreakdown(jobPrice, tip);

  return NextResponse.json({
    breakdown,
    stripeConfigured: isStripeConfigured(),
  });
}

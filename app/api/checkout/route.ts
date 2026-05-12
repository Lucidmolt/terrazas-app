import { NextResponse } from 'next/server';
import { createJobPaymentIntent, captureJobPayment, getPriceBreakdown, isStripeConfigured } from '@/lib/stripe';

// POST /api/checkout — create payment intent for a job
export async function POST(request: Request) {
  try {
    const { jobId, jobPrice, tipAmount = 0, customerEmail } = await request.json();

    if (!jobId || !jobPrice || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: jobId, jobPrice, customerEmail' },
        { status: 400 }
      );
    }

    const result = await createJobPaymentIntent(jobPrice, tipAmount, customerEmail, jobId);

    return NextResponse.json({
      ...result,
      stripeConfigured: isStripeConfigured(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/checkout?jobPrice=75&tip=10 — preview price breakdown
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

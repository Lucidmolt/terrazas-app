import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createTipPayment } from '@/lib/stripe';

// POST /api/tips — create a tip for a completed job
export async function POST(request: Request) {
  try {
    const { jobId, customerId, providerId, amount } = await request.json();

    if (!jobId || !customerId || !providerId || !amount) {
      return NextResponse.json(
        { error: 'jobId, customerId, providerId, and amount are required' },
        { status: 400 }
      );
    }

    if (amount < 1 || amount > 500) {
      return NextResponse.json(
        { error: 'Tip amount must be between $1 and $500' },
        { status: 400 }
      );
    }

    // Verify the job exists and is completed
    const job = await db.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.status !== 'completed') {
      return NextResponse.json({ error: 'Can only tip on completed jobs' }, { status: 400 });
    }

    // Get provider's Stripe account (for when Stripe is live)
    const provider = await db.provider.findUnique({
      where: { id: providerId },
      select: { stripeAccountId: true },
    });

    // Process payment through Stripe (mock mode until configured)
    const paymentResult = await createTipPayment(amount, provider?.stripeAccountId);

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error || 'Payment failed' },
        { status: 402 }
      );
    }

    // Record the tip
    const tip = await db.tip.create({
      data: {
        jobId,
        customerId,
        providerId,
        amount,
        stripePaymentId: paymentResult.paymentIntentId,
        status: 'completed',
      },
    });

    return NextResponse.json({ tip, payment: paymentResult }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Tip already exists for this job' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/tips?providerId=xxx — list tips received by a provider
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get('providerId');
  const customerId = searchParams.get('customerId');

  try {
    const where: any = {};
    if (providerId) where.providerId = providerId;
    if (customerId) where.customerId = customerId;

    const tips = await db.tip.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        job: { select: { serviceType: true, tier: true, address: true, completedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    // Calculate totals
    const total = tips.reduce((sum, t) => sum + t.amount, 0);

    return NextResponse.json({ tips, total, count: tips.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isStripeConfigured } from '@/lib/stripe';
import { requireAuth } from '@/lib/api-auth';

// POST /api/tips — create a tip for a completed job
export async function POST(request: Request) {
  // C1 FIX: Require authentication
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { jobId, providerId, amount } = await request.json();

    if (!jobId || !providerId || !amount) {
      return NextResponse.json(
        { error: 'jobId, providerId, and amount are required' },
        { status: 400 }
      );
    }

    if (amount < 1 || amount > 500) {
      return NextResponse.json(
        { error: 'Tip amount must be between $1 and $500' },
        { status: 400 }
      );
    }

    // Use authenticated user as the tipper
    const customerId = dbUser!.id;

    // Verify the job exists and is completed
    const job = await db.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.status !== 'completed') {
      return NextResponse.json({ error: 'Can only tip on completed jobs' }, { status: 400 });
    }
    if (job.customerId !== customerId) {
      return NextResponse.json({ error: 'Not authorized to tip on this job' }, { status: 403 });
    }

    // Record the tip (payment processing handled separately via Stripe when configured)
    const tip = await db.tip.create({
      data: {
        jobId,
        customerId,
        providerId,
        amount,
        stripePaymentId: null,
        status: isStripeConfigured() ? 'pending' : 'completed',
      },
    });

    return NextResponse.json({ tip, stripeConfigured: isStripeConfigured() }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Tip already exists for this job' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/tips?providerId=xxx — list tips received (requires auth)
export async function GET(request: Request) {
  // C1 FIX: Require authentication
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get('providerId');

  try {
    const where: any = {};
    // Scope to user's own tips unless they have a provider record
    const provider = await db.provider.findFirst({ where: { email: dbUser!.email! } });
    if (providerId && provider?.id === providerId) {
      where.providerId = providerId;
    } else {
      where.customerId = dbUser!.id;
    }

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

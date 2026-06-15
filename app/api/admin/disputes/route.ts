import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';
import { refundJobPayment } from '@/lib/stripe';

// GET /api/admin/disputes — List all disputes for admin review
export async function GET(request: Request) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const disputes = await db.job.findMany({
      where: {
        disputeStatus: { not: null },
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        provider: { select: { id: true, businessName: true, email: true } },
      },
      orderBy: { disputedAt: 'desc' },
    });

    return NextResponse.json({ disputes });
  } catch (error: any) {
    console.error('[Admin Disputes GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch disputes' }, { status: 500 });
  }
}

// POST /api/admin/disputes — Resolve a dispute
export async function POST(request: Request) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const { jobId, action, resolutionNotes } = await request.json();

    if (!jobId || !action) {
      return NextResponse.json({ error: 'jobId and action are required' }, { status: 400 });
    }

    if (action !== 'refund' && action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action. Use "refund" or "reject".' }, { status: 400 });
    }

    const job = await db.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (!job.disputeStatus) {
      return NextResponse.json({ error: 'Job is not in a disputed state' }, { status: 400 });
    }

    const nextStatus = action === 'refund' ? 'resolved_refunded' : 'resolved_rejected';

    // If action is refund, trigger a refund/cancel on Stripe if linked
    let refundResult = { success: true };
    if (action === 'refund' && job.paymentIntentId) {
      refundResult = await refundJobPayment(job.paymentIntentId);
    }

    // Update job dispute status
    const updatedJob = await db.job.update({
      where: { id: jobId },
      data: {
        disputeStatus: nextStatus,
        status: action === 'refund' ? 'cancelled' : job.status, // Move to cancelled if refunded
      },
    });

    // Notify customer
    await db.notification.create({
      data: {
        userId: job.customerId,
        jobId,
        type: 'system',
        channel: 'in_app',
        title: action === 'refund' ? '✅ Dispute Approved & Refunded' : '❌ Dispute Dismissed',
        body: action === 'refund'
          ? `Your dispute was approved. Refund of $${job.customerTotal.toFixed(2)} has been initiated.`
          : `Your dispute was dismissed. Payout has been released to the provider.`,
        isSent: true,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      job: updatedJob,
      refunded: action === 'refund',
    });
  } catch (error: any) {
    console.error('[Admin Disputes POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to resolve dispute' }, { status: 500 });
  }
}

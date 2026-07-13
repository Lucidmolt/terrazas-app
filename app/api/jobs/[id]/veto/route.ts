import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// POST /api/jobs/[id]/veto — Customer declines the quote / assigned pro.
// Single-business mode: a decline closes the request (no rebroadcast).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // C1 FIX: Require authentication
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: jobId } = await params;

  try {
    const { reason } = await request.json();

    // Use authenticated user's ID — not from request body
    const customerId = dbUser!.id;

    // Get the job
    const job = await db.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Must be in pending_approval status
    if (job.status !== 'pending_approval') {
      return NextResponse.json({ error: 'Job is not pending approval' }, { status: 409 });
    }

    // Verify this is the customer's job
    if (job.customerId !== customerId) {
      return NextResponse.json({ error: 'Not authorized to veto this job' }, { status: 403 });
    }

    // Check veto window (10 minutes from claim)
    if (job.approvalDeadline && new Date() > job.approvalDeadline) {
      return NextResponse.json({ error: 'Veto window has expired. Provider was auto-approved.' }, { status: 410 });
    }

    const declinedProviderId = job.providerId!;

    // Record the decline (kept as a Veto row for feedback analytics)
    await db.veto.create({
      data: {
        jobId,
        providerId: declinedProviderId,
        customerId,
        reason: reason || null,
      },
    });

    // Single-business mode: declining the quote/price cancels the request.
    // The customer can call the business or submit a new request.
    const updatedJob = await db.job.update({
      where: { id: jobId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason ? `Customer declined: ${reason}` : 'Customer declined the quote',
        approvalDeadline: null,
        quotedPrice: null,
      },
    });

    // Let the business know their quote was declined (non-blocking)
    db.notification.create({
      data: {
        userId: (await db.provider.findUnique({ where: { id: declinedProviderId }, select: { userId: true } }))!.userId,
        jobId,
        type: 'quote_declined',
        channel: 'in_app',
        title: 'Quote declined',
        body: `The customer passed on your quote for ${job.serviceType} at ${job.address}.${reason ? ` Reason: ${reason}` : ''}`,
        isSent: true,
        sentAt: new Date(),
      },
    }).catch((err) => console.error('[Veto] Notification error:', err));

    return NextResponse.json({
      job: updatedJob,
      status: 'cancelled',
      message: 'No problem — the request has been closed. Submit a new request anytime.',
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

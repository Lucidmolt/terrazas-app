import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// PATCH /api/jobs/status — update job status through the lifecycle
export async function PATCH(request: Request) {
  // C1 FIX: Require authentication
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { jobId, status, photoBeforeUrl, photoAfterUrl } = await request.json();

    if (!jobId || !status) {
      return NextResponse.json({ error: 'jobId and status are required' }, { status: 400 });
    }

    // Verify the user is the customer or provider for this job
    const job = await db.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const provider = await db.provider.findUnique({ where: { userId: dbUser!.id } });
    const isCustomer = job.customerId === dbUser!.id;
    const isProvider = !!provider && job.providerId === provider.id;

    if (!isCustomer && !isProvider) {
      return NextResponse.json({ error: 'Not authorized to update this job' }, { status: 403 });
    }

    // ── Transition state machine ──
    // Work progression belongs to the provider; customers may only cancel,
    // and only before work has started. Nothing can be rewound.
    const providerTransitions: Record<string, string[]> = {
      active: ['en_route', 'in_progress', 'cancelled'],
      en_route: ['in_progress', 'cancelled'],
      in_progress: ['completed'],
      pending_claim: ['cancelled'], // declining a new request
    };
    const customerTransitions: Record<string, string[]> = {
      pending_claim: ['cancelled'],
      pending_approval: ['cancelled'],
      active: ['cancelled'],
    };

    const allowed = isProvider
      ? providerTransitions[job.status] || []
      : customerTransitions[job.status] || [];

    if (!allowed.includes(status)) {
      return NextResponse.json({
        error: 'INVALID_TRANSITION',
        message: `Cannot move a ${job.status} job to ${status}${isCustomer && !isProvider ? ' as the customer' : ''}.`,
      }, { status: 409 });
    }

    // Completion requires proof-of-work photo
    if (status === 'completed' && !photoAfterUrl && !job.photoAfterUrl) {
      return NextResponse.json({
        error: 'PHOTO_REQUIRED',
        message: 'Upload an after photo to complete the job.',
      }, { status: 400 });
    }

    const updateData: any = { status };
    if (status === 'cancelled') {
      updateData.cancelledAt = new Date();
      updateData.cancelReason = isProvider ? 'Cancelled by business' : 'Cancelled by customer';
    }

    // Attach photos if provided
    if (photoBeforeUrl) updateData.photoBeforeUrl = photoBeforeUrl;
    if (photoAfterUrl) updateData.photoAfterUrl = photoAfterUrl;

    // Set completion timestamp and record earnings
    if (status === 'completed' && job.status !== 'completed') {
      updateData.completedAt = new Date();
      if (job.providerId) {
        const { recordJobEarnings } = await import('@/lib/payouts');
        const payoutAmount = job.providerPayout > 0 ? job.providerPayout : job.price * 0.85;
        await recordJobEarnings(job.providerId, job.id, payoutAmount);

        // Lifetime completion count + tier progression
        const { onJobCompleted } = await import('@/lib/risk-tier');
        await onJobCompleted(job.providerId, job.id);
      }

      // Tell the customer their service is done (review link) — non-blocking
      import('@/lib/notifications').then(({ notifyJobCompleted }) =>
        notifyJobCompleted(job.id)
      ).catch((err) => console.error('[Status API] Completion notify error:', err));

      // ── Trigger Quality Audit comparison scan ──
      const beforePhoto = job.photoFrontUrl;
      const afterPhoto = photoAfterUrl || job.photoAfterUrl;
      if (beforePhoto && afterPhoto) {
        try {
          const { compareBeforeAfter } = await import('@/lib/yard-vision');
          const audit = await compareBeforeAfter(beforePhoto, afterPhoto);
          updateData.qualityScore = audit.qualityScore;
          updateData.qualityPassed = audit.qualityPassed;
          updateData.qualityFeedback = audit.qualityFeedback;
        } catch (err) {
          console.error('[Status API] Quality audit failed:', err);
        }
      }
    }

    const updatedJob = await db.job.update({
      where: { id: jobId },
      data: updateData,
    });

    return NextResponse.json({ job: updatedJob });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

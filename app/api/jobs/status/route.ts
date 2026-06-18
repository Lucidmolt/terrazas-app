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

    // Validate status transitions
    const validStatuses = ['broadcast', 'pending_claim', 'active', 'en_route', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    // Verify the user is the customer or provider for this job
    const job = await db.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check the user has a provider record if they're the provider
    const provider = await db.provider.findFirst({ where: { email: dbUser!.email! } });
    const isCustomer = job.customerId === dbUser!.id;
    const isProvider = provider && job.providerId === provider.id;

    if (!isCustomer && !isProvider) {
      return NextResponse.json({ error: 'Not authorized to update this job' }, { status: 403 });
    }

    const updateData: any = { status };

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
      }

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

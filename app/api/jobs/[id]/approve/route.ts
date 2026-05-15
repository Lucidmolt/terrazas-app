import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// POST /api/jobs/[id]/approve — Customer approves the claiming provider
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // C1 FIX: Require authentication
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: jobId } = await params;

  try {
    const job = await db.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'pending_approval') {
      return NextResponse.json({ error: 'Job is not pending approval' }, { status: 409 });
    }

    // Verify the authenticated user owns this job
    if (job.customerId !== dbUser!.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Mark the claim as successful
    if (job.providerId) {
      await db.claim.updateMany({
        where: { jobId, providerId: job.providerId },
        data: { wasSuccessful: true },
      });
    }

    // Approve the job
    const updatedJob = await db.job.update({
      where: { id: jobId },
      data: {
        status: 'active',
        approvedAt: new Date(),
        autoApproved: false,
      },
    });

    return NextResponse.json({
      job: updatedJob,
      message: 'Provider approved! They are on their way.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

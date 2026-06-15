import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// POST /api/jobs/[id]/dispute — Customer files a dispute for a job
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: jobId } = await params;

  try {
    const { reason, photoUrl } = await request.json();

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Dispute reason is required' }, { status: 400 });
    }

    if (!photoUrl) {
      return NextResponse.json({ error: 'Photo evidence is required to file a dispute' }, { status: 400 });
    }

    const job = await db.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify owner
    if (job.customerId !== dbUser!.id) {
      return NextResponse.json({ error: 'Forbidden: not authorized to dispute this job' }, { status: 403 });
    }

    // Time window verification: Must be within 24 hours of job completion
    if (!job.completedAt) {
      return NextResponse.json({ error: 'Job is not completed yet' }, { status: 400 });
    }

    const completedAtTime = new Date(job.completedAt).getTime();
    const ageMins = (Date.now() - completedAtTime) / (1000 * 60);

    if (ageMins > 24 * 60) {
      return NextResponse.json({ error: 'Dispute window has expired (must file within 24 hours of completion)' }, { status: 400 });
    }

    // Apply abuse prevention check: Customer dispute ratio check
    // If the customer has done > 3 jobs and has > 15% dispute rate, they flag for admin review
    const totalCustomerJobs = await db.job.count({
      where: { customerId: dbUser!.id, status: 'completed' },
    });
    const totalCustomerDisputes = await db.job.count({
      where: { customerId: dbUser!.id, disputeStatus: { not: null } },
    });

    const isHighDisputeRate = totalCustomerJobs >= 3 && (totalCustomerDisputes / totalCustomerJobs) > 0.15;

    // Save dispute details
    const updatedJob = await db.job.update({
      where: { id: jobId },
      data: {
        disputedAt: new Date(),
        disputeReason: reason.trim(),
        disputePhotoUrl: photoUrl,
        disputeStatus: isHighDisputeRate ? 'pending_flagged' : 'pending',
      },
    });

    // Create system notification for admin
    await db.notification.create({
      data: {
        userId: job.customerId, // Visible to customer
        jobId,
        type: 'system',
        channel: 'in_app',
        title: isHighDisputeRate ? '🚨 Dispute Flagged (High Abuse Risk)' : '⚠️ Job Dispute Filed',
        body: `Dispute filed for job in ${job.zipCode}. Payout held in escrow pending admin review.`,
        isSent: true,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      job: updatedJob,
      flagged: isHighDisputeRate,
      message: isHighDisputeRate
        ? 'Dispute filed. Due to high account dispute frequency, this requires manual admin verification.'
        : 'Dispute filed. Escrow payout has been suspended pending review.',
    });
  } catch (error: any) {
    console.error('[Dispute API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to file dispute' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastJobToProviders } from '@/lib/notifications';
import { requireAuth } from '@/lib/api-auth';

// POST /api/jobs/[id]/veto — Customer vetoes the claiming provider
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

    // Check max vetos (3 per job)
    if (job.vetoCount >= 3) {
      return NextResponse.json({
        error: 'Maximum vetos reached. This job requires manual matching.',
        status: 'manual_match',
      }, { status: 429 });
    }

    const vetoedProviderId = job.providerId!;

    // Record the veto
    await db.veto.create({
      data: {
        jobId,
        providerId: vetoedProviderId,
        customerId,
        reason: reason || null,
      },
    });

    // Add provider to blocklist
    const blockedProviders: string[] = JSON.parse(job.blockedProviders || '[]');
    blockedProviders.push(vetoedProviderId);

    // Update veto reasons tracking
    const vetoReasons: string[] = JSON.parse(job.vetoReasons || '[]');
    if (reason) vetoReasons.push(reason);

    // Increment provider's veto count
    await db.provider.update({
      where: { id: vetoedProviderId },
      data: {
        vetoCount: { increment: 1 },
        lastVetoAt: new Date(),
      },
    });

    // Mark the claim as unsuccessful
    await db.claim.updateMany({
      where: { jobId, providerId: vetoedProviderId },
      data: { wasSuccessful: false },
    });

    const newVetoCount = job.vetoCount + 1;
    const newStatus = newVetoCount >= 3 ? 'manual_match' : 'broadcast';

    // Reset job to broadcast (or manual_match if 3 vetos)
    const updatedJob = await db.job.update({
      where: { id: jobId },
      data: {
        status: newStatus,
        providerId: null,
        pendingProId: null,
        etaMinutes: null,
        claimedAt: null,
        approvalDeadline: null,
        autoApproved: false,
        blockedProviders: JSON.stringify(blockedProviders),
        vetoCount: newVetoCount,
        vetoReasons: JSON.stringify(vetoReasons),
        broadcastedAt: newStatus === 'broadcast' ? new Date() : null,
      },
    });

    // Re-broadcast if still open (non-blocking)
    if (newStatus === 'broadcast') {
      broadcastJobToProviders(jobId).catch((err) => {
        console.error('Re-broadcast error:', err);
      });
    }

    return NextResponse.json({
      job: updatedJob,
      vetoCount: newVetoCount,
      maxVetos: 3,
      status: newStatus,
      message: newStatus === 'broadcast'
        ? 'Provider removed. Job is being re-broadcasted to other providers.'
        : 'Maximum vetos reached. Our team will help match you with a provider.',
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

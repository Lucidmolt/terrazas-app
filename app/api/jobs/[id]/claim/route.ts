import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifyJobClaimed } from '@/lib/notifications';

// ── POST /api/jobs/[id]/claim — Atomic Lock Engine ──────────────────
// Uses PostgreSQL's atomic UPDATE...WHERE to prevent race conditions.
// If two providers hit claim simultaneously, only one will match
// status='broadcast' — the other gets a 409 "Job Taken" response.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;

  try {
    const { providerId, etaMinutes } = await request.json();

    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
    }

    // ── Pre-condition: Verify provider qualifications ──
    const provider = await db.provider.findUnique({
      where: { id: providerId },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!provider || !provider.isActive) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED_PRO', message: 'Provider not found or inactive' },
        { status: 403 }
      );
    }

    if (provider.profileStatus !== 'verified') {
      return NextResponse.json(
        { error: 'UNVERIFIED_PRO', message: 'Provider profile must be verified to claim jobs' },
        { status: 403 }
      );
    }

    // ── Pre-condition: Check veto/block list ──
    const job = await db.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const blockedProviders: string[] = JSON.parse(job.blockedProviders || '[]');
    if (blockedProviders.includes(providerId)) {
      return NextResponse.json(
        { error: 'BLOCKED_PRO', message: 'You are not eligible to claim this job' },
        { status: 403 }
      );
    }

    // ── ATOMIC LOCK: Single UPDATE with WHERE status='broadcast' ──
    // This is the core race-condition prevention. PostgreSQL guarantees
    // that UPDATE...WHERE is atomic — if two transactions hit simultaneously,
    // only ONE will match status='broadcast'. The loser gets count=0.
    const now = new Date();
    const approvalDeadline = new Date(now.getTime() + 10 * 60 * 1000);

    const lockResult = await db.job.updateMany({
      where: {
        id: jobId,
        status: 'broadcast', // ← This is the atomic guard
      },
      data: {
        status: 'pending_approval',
        providerId,
        pendingProId: providerId,
        etaMinutes: etaMinutes || 30,
        claimedAt: now,
        approvalDeadline,
      },
    });

    // ── LOCK FAILED: Job was already claimed ──
    if (lockResult.count === 0) {
      // Log the failed attempt
      await db.claim.create({
        data: {
          jobId,
          providerId,
          etaMinutes: etaMinutes || 30,
          wasSuccessful: false,
        },
      });

      return NextResponse.json(
        { error: 'JOB_TAKEN', message: 'This job has already been claimed by another provider.' },
        { status: 409 }
      );
    }

    // ── LOCK SUCCEEDED: Log the winning claim ──
    await db.claim.create({
      data: {
        jobId,
        providerId,
        etaMinutes: etaMinutes || 30,
        wasSuccessful: true,
      },
    });

    // Fetch the updated job for response
    const updatedJob = await db.job.findUnique({
      where: { id: jobId },
      include: {
        customer: { select: { id: true, name: true } },
      },
    });

    // Notify customer (non-blocking)
    notifyJobClaimed(jobId).catch((err) => {
      console.error('[AtomicLock] Claim notification error:', err);
    });

    return NextResponse.json({
      job: updatedJob,
      provider: {
        id: provider.id,
        businessName: provider.businessName,
        logoUrl: provider.logoUrl,
        rating: provider.rating,
        reviewCount: provider.reviewCount,
        bio: provider.bio,
        portfolioPhotos: JSON.parse(provider.portfolioPhotos || '[]'),
        isVerified: provider.isVerified,
        insuranceStatus: provider.insuranceStatus,
        yearsInBusiness: provider.yearsInBusiness,
        teamSize: provider.teamSize,
      },
      approvalDeadline: approvalDeadline.toISOString(),
      message: 'Job claimed! Customer has 10 minutes to approve or reassign.',
    }, { status: 200 });

  } catch (error: any) {
    console.error('[AtomicLock] Claim error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

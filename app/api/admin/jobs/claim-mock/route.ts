import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import { notifyJobClaimed } from '@/lib/notifications';

// POST /api/admin/jobs/claim-mock — Simulate provider claim for testing
export async function POST(request: Request) {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { jobId } = await request.json();
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    // Get the job
    const job = await db.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Ensure authorization (caller owns the job OR has admin role)
    if (job.customerId !== dbUser!.id && dbUser!.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: not authorized to mock claim this job' }, { status: 403 });
    }

    // Must be in broadcast status to simulate a claim
    if (job.status !== 'broadcast') {
      return NextResponse.json({ error: `Job must be in "broadcast" status to simulate claim. Current: ${job.status}` }, { status: 400 });
    }

    // Find a random active verified provider in the database
    const providers = await db.provider.findMany({
      where: {
        isActive: true,
        profileStatus: 'verified',
      },
    });

    if (providers.length === 0) {
      return NextResponse.json({ error: 'No active verified providers found in database. Seed data may be missing.' }, { status: 404 });
    }

    const randomProvider = providers[Math.floor(Math.random() * providers.length)];

    const now = new Date();
    const approvalDeadline = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes veto window

    // Update job atomically
    const updatedJob = await db.job.update({
      where: { id: jobId },
      data: {
        status: 'pending_approval',
        providerId: randomProvider.id,
        pendingProId: randomProvider.id,
        etaMinutes: 25,
        claimedAt: now,
        approvalDeadline,
      },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            logoUrl: true,
            rating: true,
            reviewCount: true,
            bio: true,
            portfolioPhotos: true,
            isVerified: true,
          },
        },
      },
    });

    // Create claims log entry
    await db.claim.create({
      data: {
        jobId,
        providerId: randomProvider.id,
        etaMinutes: 25,
        wasSuccessful: true,
      },
    });

    // Notify customer (non-blocking)
    notifyJobClaimed(jobId).catch((err) => {
      console.error('[MockClaim] Claim notification error:', err);
    });

    return NextResponse.json({
      job: updatedJob,
      message: 'Job mock claimed! Provider assigned.',
    });
  } catch (error: any) {
    console.error('[MockClaim API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to mock claim job' }, { status: 500 });
  }
}

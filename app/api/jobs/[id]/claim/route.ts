import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifyJobClaimed } from '@/lib/notifications';

// POST /api/jobs/[id]/claim — Provider claims a job
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

    // Get the job
    const job = await db.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Must be in broadcast status
    if (job.status !== 'broadcast') {
      return NextResponse.json({ error: 'Job is no longer available' }, { status: 409 });
    }

    // Check if provider is blocked (vetoed) on this job
    const blockedProviders: string[] = JSON.parse(job.blockedProviders || '[]');
    if (blockedProviders.includes(providerId)) {
      return NextResponse.json({ error: 'You are not eligible to claim this job' }, { status: 403 });
    }

    // Verify provider is active and verified
    const provider = await db.provider.findUnique({
      where: { id: providerId },
      include: { user: { select: { name: true } } },
    });
    if (!provider || !provider.isActive) {
      return NextResponse.json({ error: 'Provider not found or inactive' }, { status: 404 });
    }
    if (provider.profileStatus !== 'verified') {
      return NextResponse.json({ error: 'Provider profile must be verified to claim jobs' }, { status: 403 });
    }

    // Set 10-minute approval deadline
    const now = new Date();
    const approvalDeadline = new Date(now.getTime() + 10 * 60 * 1000);

    // Create the claim record
    await db.claim.create({
      data: {
        jobId,
        providerId,
        etaMinutes: etaMinutes || 30,
        wasSuccessful: false, // Will be set to true when approved
      },
    });

    // Update job status to pending_approval
    const updatedJob = await db.job.update({
      where: { id: jobId },
      data: {
        status: 'pending_approval',
        providerId,
        pendingProId: providerId,
        etaMinutes: etaMinutes || 30,
        claimedAt: now,
        approvalDeadline,
      },
    });

    // Notify customer (non-blocking)
    notifyJobClaimed(jobId).catch((err) => {
      console.error('Claim notification error:', err);
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCronSecret } from '@/lib/api-auth';

// GET /api/cron/auto-approve — Auto-approve jobs past their 10-minute deadline
// Called by Vercel Cron every minute
export async function GET(request: Request) {
  // H2 FIX: Fail-closed — require CRON_SECRET, reject if unset
  const cronError = requireCronSecret(request);
  if (cronError) return cronError;

  try {
    const now = new Date();

    // Find all jobs in pending_approval where the deadline has passed
    const expiredJobs = await db.job.findMany({
      where: {
        status: 'pending_approval',
        approvalDeadline: { lte: now },
      },
      include: {
        provider: { select: { businessName: true } },
      },
    });

    if (expiredJobs.length === 0) {
      return NextResponse.json({ autoApproved: 0, message: 'No expired approvals' });
    }

    // Auto-approve each one
    const results = await Promise.all(
      expiredJobs.map(async (job) => {
        try {
          // Mark claim as successful
          if (job.providerId) {
            await db.claim.updateMany({
              where: { jobId: job.id, providerId: job.providerId },
              data: { wasSuccessful: true },
            });
          }

          await db.job.update({
            where: { id: job.id },
            data: {
              status: 'active',
              autoApproved: true,
              approvedAt: now,
            },
          });

          return { jobId: job.id, provider: job.provider?.businessName, status: 'auto_approved' };
        } catch (err: any) {
          return { jobId: job.id, status: 'error', error: err.message };
        }
      })
    );

    console.log(`[Cron] Auto-approved ${results.filter(r => r.status === 'auto_approved').length} jobs`);

    return NextResponse.json({
      autoApproved: results.filter(r => r.status === 'auto_approved').length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/jobs/confirm — customer confirms or rejects a pro's ETA
export async function POST(request: Request) {
  try {
    const { jobId, approved } = await request.json();

    if (!jobId || typeof approved !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'jobId and approved (boolean) are required' },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const job = await tx.job.findUnique({ where: { id: jobId } });

      if (!job || !job.pendingProId) {
        return { success: false, message: 'No pending pro for this job' };
      }

      if (approved) {
        // Accept: assign the pro
        await tx.job.update({
          where: { id: jobId },
          data: {
            status: 'active',
            providerId: job.pendingProId,
            pendingProId: null,
            claimedAt: new Date(),
          },
        });
        return { success: true, message: 'Pro confirmed! They\'re on the way.' };
      } else {
        // Reject: put job back on broadcast
        await tx.job.update({
          where: { id: jobId },
          data: {
            status: 'broadcast',
            pendingProId: null,
            etaMinutes: null,
          },
        });
        return { success: true, message: 'Job rebroadcast to network' };
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

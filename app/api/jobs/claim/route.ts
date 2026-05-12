import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/jobs/claim — atomic job claim
export async function POST(request: Request) {
  try {
    let { jobId, providerId, etaMinutes } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { success: false, message: 'jobId is required' },
        { status: 400 }
      );
    }

    // Demo mode: resolve actual provider ID from DB
    if (!providerId || providerId.startsWith('demo')) {
      const demoPro = await db.provider.findFirst({ where: { isActive: true } });
      if (!demoPro) {
        return NextResponse.json({ success: false, message: 'No provider found' }, { status: 500 });
      }
      providerId = demoPro.id;
    }

    // Atomic claim — check status and update in one transaction
    const result = await db.$transaction(async (tx) => {
      const job = await tx.job.findUnique({ where: { id: jobId } });

      if (!job) {
        return { success: false, message: 'Job not found' };
      }

      if (job.status !== 'broadcast') {
        return { success: false, message: 'Job is no longer available' };
      }

      // Claim it
      await tx.job.update({
        where: { id: jobId },
        data: {
          status: 'pending_claim',
          pendingProId: providerId,
          etaMinutes: etaMinutes || 30,
        },
      });

      // Log the claim attempt
      await tx.claim.create({
        data: {
          jobId,
          providerId,
          etaMinutes: etaMinutes || 30,
          wasSuccessful: true,
        },
      });

      return { success: true, message: 'ETA sent to customer for approval' };
    });

    const status = result.success ? 200 : 409;
    return NextResponse.json(result, { status });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

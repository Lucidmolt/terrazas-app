import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH /api/jobs/status — update job status through the lifecycle
export async function PATCH(request: Request) {
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

    const updateData: any = { status };

    // Attach photos if provided
    if (photoBeforeUrl) updateData.photoBeforeUrl = photoBeforeUrl;
    if (photoAfterUrl) updateData.photoAfterUrl = photoAfterUrl;

    // Set completion timestamp
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    const job = await db.job.update({
      where: { id: jobId },
      data: updateData,
    });

    return NextResponse.json({ job });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

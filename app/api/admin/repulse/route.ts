import { NextResponse } from 'next/server';
import { repulseJob } from '@/lib/escalation';

// POST /api/admin/repulse — Manual re-broadcast of a stale job
// This is the "Re-pulse" button in the admin dashboard.
// It resets the broadcast timer and sends the job to all providers again.
export async function POST(request: Request) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const result = await repulseJob(jobId);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Job not found or not in broadcast status' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      providersNotified: result.providersNotified,
      message: `Job re-pulsed to ${result.providersNotified} providers.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

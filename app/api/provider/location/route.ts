import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireProvider } from '@/lib/api-auth';

// POST /api/provider/location — Update provider location telemetry for an active job
export async function POST(request: Request) {
  const { provider: authProvider, error: authError } = await requireProvider();
  if (authError) return authError;

  try {
    const { jobId, lat, lng } = await request.json();

    if (!jobId || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: 'jobId, lat, and lng are required' }, { status: 400 });
    }

    const job = await db.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify this provider is assigned to the job
    if (job.providerId !== authProvider!.id) {
      return NextResponse.json({ error: 'Forbidden: you are not assigned to this job' }, { status: 403 });
    }

    // Verify the job status is strictly "en_route"
    if (job.status !== 'en_route') {
      return NextResponse.json({ error: `Telemetry is only active when en route. Current status: ${job.status}` }, { status: 400 });
    }

    // Update coordinates
    await db.job.update({
      where: { id: jobId },
      data: {
        providerLocLat: parseFloat(lat),
        providerLocLng: parseFloat(lng),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Telemetry API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update telemetry location' }, { status: 500 });
  }
}

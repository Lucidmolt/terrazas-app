import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// GET /api/jobs/[id]/chat — Get chat messages for a specific job
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: jobId } = await params;

  try {
    const job = await db.job.findUnique({
      where: { id: jobId },
      include: { provider: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Auth check: User must be customer of the job, the assigned provider, or an admin
    const isCustomer = job.customerId === dbUser!.id;
    const isProvider = job.provider?.userId === dbUser!.id;
    const isAdmin = dbUser!.role === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: not authorized to view chat' }, { status: 403 });
    }

    const messages = await db.message.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('[Chat API] GET Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to retrieve messages' }, { status: 500 });
  }
}

// POST /api/jobs/[id]/chat — Post a new chat message
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: jobId } = await params;

  try {
    const { content } = await request.json();
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    const job = await db.job.findUnique({
      where: { id: jobId },
      include: { provider: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Auth check: User must be customer of the job, the assigned provider, or an admin
    const isCustomer = job.customerId === dbUser!.id;
    const isProvider = job.provider?.userId === dbUser!.id;
    const isAdmin = dbUser!.role === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: not authorized to send messages' }, { status: 403 });
    }

    const message = await db.message.create({
      data: {
        jobId,
        senderId: dbUser!.id,
        content: content.trim(),
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error: any) {
    console.error('[Chat API] POST Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to post message' }, { status: 500 });
  }
}

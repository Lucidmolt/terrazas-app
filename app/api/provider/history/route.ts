import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireProvider } from '@/lib/api-auth';

// GET /api/provider/history — Returns completed/cancelled job history for a provider
export async function GET(request: Request) {
  const { provider, error: authError } = await requireProvider();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const status = searchParams.get('status') || 'completed,cancelled';

  try {
    const statusList = status.split(',').map(s => s.trim());

    const [jobs, total] = await Promise.all([
      db.job.findMany({
        where: {
          providerId: provider!.id,
          status: { in: statusList },
        },
        include: {
          customer: { select: { name: true } },
          review: { select: { rating: true, comment: true } },
          tip: { select: { amount: true, status: true } },
        },
        orderBy: { completedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.job.count({
        where: {
          providerId: provider!.id,
          status: { in: statusList },
        },
      }),
    ]);

    return NextResponse.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

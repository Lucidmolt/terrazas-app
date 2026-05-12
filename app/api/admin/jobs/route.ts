import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/jobs — list all jobs with customer/provider info
export async function GET() {
  try {
    const jobs = await db.job.findMany({
      include: {
        customer: { select: { name: true, email: true } },
        provider: { select: { businessName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ jobs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

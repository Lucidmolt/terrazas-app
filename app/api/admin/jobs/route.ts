import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/api-auth';

// GET /api/admin/jobs — list all jobs with customer/provider info
export async function GET() {
  // H3 FIX: Require admin role
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

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

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireProvider, requireAuth } from '@/lib/api-auth';

// GET /api/provider/me — Returns current provider's full info
export async function GET() {
  const { provider, error: authError } = await requireProvider();
  if (authError) return authError;

  try {
    const fullProvider = await db.provider.findUnique({
      where: { id: provider!.id },
      include: { user: { select: { name: true, email: true, avatarUrl: true } } },
    });

    if (!fullProvider) {
      return NextResponse.json({ provider: null }, { status: 404 });
    }

    // Fetch job history stats
    const [completedJobs, cancelledJobs, thisMonthEarnings, last6Months] = await Promise.all([
      db.job.count({ where: { providerId: provider!.id, status: 'completed' } }),
      db.job.count({ where: { providerId: provider!.id, status: 'cancelled' } }),
      db.job.aggregate({
        where: {
          providerId: provider!.id,
          status: 'completed',
          completedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { providerPayout: true },
        _count: true,
      }),
      // Last 6 months earnings by month
      db.job.findMany({
        where: {
          providerId: provider!.id,
          status: 'completed',
          completedAt: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
        },
        select: { providerPayout: true, completedAt: true },
        orderBy: { completedAt: 'asc' },
      }),
    ]);

    // Aggregate monthly earnings
    const monthlyEarnings: Record<string, { revenue: number; jobs: number }> = {};
    for (const job of last6Months) {
      if (!job.completedAt) continue;
      const key = `${job.completedAt.getFullYear()}-${String(job.completedAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyEarnings[key]) monthlyEarnings[key] = { revenue: 0, jobs: 0 };
      monthlyEarnings[key].revenue += job.providerPayout;
      monthlyEarnings[key].jobs += 1;
    }

    return NextResponse.json({
      provider: fullProvider,
      stats: {
        completedJobs,
        cancelledJobs,
        thisMonthEarnings: thisMonthEarnings._sum.providerPayout || 0,
        thisMonthJobs: thisMonthEarnings._count || 0,
        monthlyEarnings: Object.entries(monthlyEarnings).map(([month, data]) => ({
          month,
          revenue: Math.round(data.revenue * 100) / 100,
          jobs: data.jobs,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/provider/me — Update provider profile
export async function PATCH(request: Request) {
  const { provider, dbUser, error: authError } = await requireProvider();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { businessName, phone, bio, zipCodes, equipmentType, teamSize, serviceRadiusMi, name } = body;

    // Update provider fields
    const updatedProvider = await db.provider.update({
      where: { id: provider!.id },
      data: {
        ...(businessName && { businessName }),
        ...(phone !== undefined && { phone }),
        ...(bio !== undefined && { bio }),
        ...(zipCodes && { zipCodes: JSON.stringify(zipCodes) }),
        ...(equipmentType && { equipmentType }),
        ...(teamSize && { teamSize }),
        ...(serviceRadiusMi && { serviceRadiusMi }),
      },
    });

    // Update user name if provided
    if (name && dbUser) {
      await db.user.update({ where: { id: dbUser.id }, data: { name } });
    }

    return NextResponse.json({ success: true, provider: updatedProvider });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

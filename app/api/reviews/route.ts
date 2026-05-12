import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/reviews — create a review for a completed job
export async function POST(request: Request) {
  try {
    const { jobId, authorId, providerId, rating, comment, photoUrl } = await request.json();

    if (!jobId || !authorId || !providerId || !rating) {
      return NextResponse.json(
        { error: 'jobId, authorId, providerId, and rating are required' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    // Verify the job is completed
    const job = await db.job.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'completed') {
      return NextResponse.json({ error: 'Can only review completed jobs' }, { status: 400 });
    }

    // Create review and update provider rating in a transaction
    const result = await db.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: { jobId, authorId, providerId, rating, comment, photoUrl },
      });

      // Recalculate provider rating
      const reviews = await tx.review.findMany({
        where: { providerId },
        select: { rating: true },
      });

      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

      await tx.provider.update({
        where: { id: providerId },
        data: {
          rating: Math.round(avgRating * 100) / 100,
          reviewCount: reviews.length,
        },
      });

      return review;
    });

    return NextResponse.json({ review: result }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Review already exists for this job' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/reviews?providerId=xxx — list reviews for a provider
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get('providerId');

  try {
    const where = providerId ? { providerId } : {};

    const reviews = await db.review.findMany({
      where,
      include: {
        author: { select: { name: true, avatarUrl: true } },
        job: { select: { serviceType: true, tier: true, zipCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    return NextResponse.json({ reviews });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

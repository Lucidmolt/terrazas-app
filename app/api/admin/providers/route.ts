import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/providers — list all providers with user info
export async function GET() {
  try {
    const providers = await db.provider.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ providers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/providers — update provider status
export async function PATCH(request: Request) {
  try {
    const { providerId, profileStatus, isVerified, rejectionReason } = await request.json();
    if (!providerId || !profileStatus) {
      return NextResponse.json({ error: 'providerId and profileStatus required' }, { status: 400 });
    }

    const provider = await db.provider.update({
      where: { id: providerId },
      data: {
        profileStatus,
        isVerified: isVerified ?? false,
        rejectionReason: rejectionReason || null,
      },
    });

    return NextResponse.json({ success: true, provider });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

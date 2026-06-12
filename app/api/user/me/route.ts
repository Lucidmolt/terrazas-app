import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// GET /api/user/me — Fetch current user profile
export async function GET() {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  if (!dbUser) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
  }

  return NextResponse.json({ user: dbUser });
}

// PATCH /api/user/me — Update current user profile
export async function PATCH(request: Request) {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  if (!dbUser) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { name, phone, address, city, state, zipCode } = body;

    // Check unique constraints for phone if provided and changed
    if (phone && phone !== dbUser.phone) {
      const existingPhone = await db.user.findFirst({
        where: { phone, id: { not: dbUser.id } },
      });
      if (existingPhone) {
        return NextResponse.json({ error: 'Phone number is already in use by another account' }, { status: 409 });
      }
    }

    const updatedUser = await db.user.update({
      where: { id: dbUser.id },
      data: {
        name: name !== undefined ? name : undefined,
        phone: phone !== undefined ? phone : undefined,
        address: address !== undefined ? address : undefined,
        city: city !== undefined ? city : undefined,
        state: state !== undefined ? state : undefined,
        zipCode: zipCode !== undefined ? zipCode : undefined,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error: any) {
    console.error('[UserMe API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update profile' }, { status: 500 });
  }
}

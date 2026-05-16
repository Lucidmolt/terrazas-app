import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// POST /api/onboarding — Complete user onboarding (customer or provider)
export async function POST(request: Request) {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { role, name, zipCode, address, businessName, phone, zipCodes, bio, equipmentType, teamSize } = body;

    // Update user profile
    const updatedUser = await db.user.update({
      where: { id: dbUser!.id },
      data: {
        name: name || dbUser!.name,
        role: role || dbUser!.role,
        zipCode: zipCode || undefined,
        address: address || undefined,
        onboardedAt: new Date(),
      },
    });

    // If provider, create or update Provider record
    if (role === 'pro') {
      const existingProvider = await db.provider.findUnique({
        where: { userId: dbUser!.id },
      });

      if (existingProvider) {
        await db.provider.update({
          where: { userId: dbUser!.id },
          data: {
            businessName: businessName || existingProvider.businessName,
            phone: phone || existingProvider.phone,
            email: dbUser!.email || existingProvider.email,
            zipCodes: zipCodes ? JSON.stringify(zipCodes) : existingProvider.zipCodes,
            bio: bio || existingProvider.bio,
            equipmentType: equipmentType || existingProvider.equipmentType,
            teamSize: teamSize || existingProvider.teamSize,
          },
        });
      } else {
        await db.provider.create({
          data: {
            userId: dbUser!.id,
            businessName: businessName || `${name}'s Lawn Care`,
            phone: phone || undefined,
            email: dbUser!.email || undefined,
            zipCodes: zipCodes ? JSON.stringify(zipCodes) : '[]',
            bio: bio || undefined,
            equipmentType: equipmentType || 'residential',
            teamSize: teamSize || 'solo',
            isActive: true,
            profileStatus: 'pending_review',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: role === 'pro' ? 'Provider profile created' : 'Customer profile saved',
    });
  } catch (error: any) {
    console.error('[Onboarding] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

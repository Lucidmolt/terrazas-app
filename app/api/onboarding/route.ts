import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/onboarding — create user + provider records
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name, email, phone, role, businessName, selectedServices, zipCodes,
      bio, logoUrl, portfolioPhotos, yearsInBusiness, teamSize, equipmentType,
      googlePlaceId, tosAccepted,
    } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.user.findFirst({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 });
    }

    // Create user
    const user = await db.user.create({
      data: {
        name, email,
        phone: phone || null,
        role: role === 'pro' ? 'pro' : 'customer',
        zipCode: zipCodes?.[0] || null,
        tosAcceptedAt: tosAccepted ? new Date() : null,
        tosVersion: tosAccepted ? '1.0' : null,
        onboardedAt: new Date(),
      },
    });

    // If pro, create provider record
    let provider = null;
    if (role === 'pro' && businessName) {
      provider = await db.provider.create({
        data: {
          userId: user.id,
          businessName,
          phone: phone || null,
          email: email || null,
          googlePlaceId: googlePlaceId || null,
          serviceTypes: JSON.stringify(selectedServices || []),
          zipCodes: JSON.stringify(zipCodes || []),
          isActive: true,
          isVerified: false,
          rating: 0,
          reviewCount: 0,
          // Profile fields
          logoUrl: logoUrl || null,
          bio: bio || null,
          portfolioPhotos: JSON.stringify(portfolioPhotos || []),
          yearsInBusiness: yearsInBusiness ? parseInt(String(yearsInBusiness)) : null,
          teamSize: teamSize || null,
          equipmentType: equipmentType || null,
          profileStatus: bio && logoUrl ? 'pending_review' : 'draft',
        },
      });
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      providerId: provider?.id || null,
      role: user.role,
    });
  } catch (error: any) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: error.message || 'Onboarding failed' }, { status: 500 });
  }
}

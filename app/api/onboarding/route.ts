import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/onboarding — create user + provider records
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, role, businessName, selectedServices, zipCodes } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 });
    }

    // Create user
    const user = await db.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        role: role === 'pro' ? 'pro' : 'customer',
      },
    });

    // If pro, create provider record
    let provider = null;
    if (role === 'pro' && businessName) {
      provider = await db.provider.create({
        data: {
          userId: user.id,
          businessName,
          serviceTypes: JSON.stringify(selectedServices || []),
          coverageZips: JSON.stringify(zipCodes || []),
          isActive: true,
          isVerified: false, // Manual verification required
          rating: 0,
          reviewCount: 0,
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

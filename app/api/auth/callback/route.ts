import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// POST /api/auth/callback — handle Supabase auth callback
// Syncs Supabase Auth user → Prisma User table, sends welcome email on first login.
export async function POST(request: Request) {
  try {
    // H4 FIX: Validate the session server-side instead of trusting client-provided data
    const supabase = await createServerSupabaseClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    // Now safely use server-verified user data
    const { db } = await import('@/lib/db');
    const email = authUser.email;
    const phone = authUser.phone;

    // Check if user exists in our DB
    let user = await db.user.findFirst({
      where: email ? { email } : { phone },
    });

    let isNewUser = false;

    if (!user) {
      // Auto-create user record on first sign-in
      isNewUser = true;
      user = await db.user.create({
        data: {
          email: email || undefined,
          phone: phone || undefined,
          name: authUser.user_metadata?.name || email?.split('@')[0] || 'New User',
          role: authUser.user_metadata?.role || 'customer',
        },
      });
    }

    // Send welcome email on first sign-in
    if (isNewUser && email) {
      try {
        const { sendWelcomeEmail } = await import('@/lib/email');
        await sendWelcomeEmail(email, user.name || 'there');
      } catch {
        // Non-fatal — user is still created
      }
    }

    return NextResponse.json({ user, synced: true, isNewUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Auth callback failed' }, { status: 500 });
  }
}

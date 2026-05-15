import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// POST /api/auth/callback — handle Supabase auth callback
// Syncs Supabase Auth user → Prisma User table, sends welcome email on first login.
export async function POST(request: Request) {
  const { event, session } = await request.json();
  const supabase = await createServerSupabaseClient();

  if (event === 'SIGNED_IN' && session) {
    // Sync Supabase Auth user → Prisma User table
    const { db } = await import('@/lib/db');
    const email = session.user.email;
    const phone = session.user.phone;

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
          name: session.user.user_metadata?.name || email?.split('@')[0] || 'New User',
          role: session.user.user_metadata?.role || 'customer',
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
  }

  return NextResponse.json({ ok: true });
}

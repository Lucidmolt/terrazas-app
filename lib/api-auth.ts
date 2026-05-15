// ── API Route Auth Guards ──────────────────────────────────────────
// Reusable server-side authentication for all API routes.
// Uses Supabase Auth getUser() (server-verified, not from cookie).

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase-server';
import { db } from '@/lib/db';

type AuthResult = {
  user: Awaited<ReturnType<typeof getAuthUser>>;
  dbUser: Awaited<ReturnType<typeof db.user.findFirst>> | null;
  error: NextResponse | null;
};

type AdminResult = AuthResult & {
  dbUser: NonNullable<AuthResult['dbUser']>;
};

/**
 * Require a valid Supabase Auth session.
 * Returns the Supabase Auth user + matching Prisma user record.
 */
export async function requireAuth(): Promise<AuthResult> {
  const user = await getAuthUser();
  if (!user) {
    return {
      user: null,
      dbUser: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // Resolve the Prisma user record
  const dbUser = await db.user.findFirst({
    where: user.email ? { email: user.email } : { phone: user.phone },
  });

  return { user, dbUser, error: null };
}

/**
 * Require admin role. Builds on requireAuth().
 */
export async function requireAdmin(): Promise<AdminResult | { user: null; dbUser: null; error: NextResponse }> {
  const { user, dbUser, error } = await requireAuth();
  if (error) return { user: null, dbUser: null, error };

  if (!dbUser || dbUser.role !== 'admin') {
    return {
      user: null,
      dbUser: null,
      error: NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 }),
    };
  }

  return { user, dbUser, error: null };
}

/**
 * Require provider role. Returns the provider record.
 */
export async function requireProvider() {
  const { user, dbUser, error } = await requireAuth();
  if (error) return { user: null, dbUser: null, provider: null, error };

  if (!dbUser) {
    return {
      user: null,
      dbUser: null,
      provider: null,
      error: NextResponse.json({ error: 'User not found' }, { status: 404 }),
    };
  }

  const provider = await db.provider.findFirst({
    where: { email: dbUser.email!, isActive: true },
  });

  if (!provider) {
    return {
      user,
      dbUser,
      provider: null,
      error: NextResponse.json({ error: 'Provider not found or inactive' }, { status: 403 }),
    };
  }

  return { user, dbUser, provider, error: null };
}

/**
 * Require a valid cron secret. Fails closed (rejects if CRON_SECRET is unset).
 */
export function requireCronSecret(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured. Cron endpoints are disabled.' },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null; // Authorized
}

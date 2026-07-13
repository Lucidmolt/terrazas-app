import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = request.nextUrl;

  // Public routes — no auth needed.
  // /post is public so anyone can fill out a booking/quote; it prompts
  // sign-in at submit time (the API still requires auth).
  const publicPaths = ['/', '/login', '/terms', '/privacy', '/onboarding', '/auth', '/post', '/yard-vision', '/review'];
  if (publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) return res;

  // API routes handle their own auth via requireAuth()/requireAdmin()/requireCronSecret()
  if (pathname.startsWith('/api/')) return res;

  // Static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) return res;

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll().map(c => ({ name: c.name, value: c.value })), setAll: (cookies) => { cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); } } }
  );

  // C3 FIX: Use getUser() instead of getSession() — server-verified, not forgeable
  const { data: { user } } = await supabase.auth.getUser();

  // Protected pages — redirect to login if no user
  const protectedPages = ['/dashboard', '/pro', '/admin'];
  if (!user && protectedPages.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Admin pages — quick metadata gate for UX only. user_metadata is
  // client-writable, so this must never be the real barrier: every admin
  // API verifies the DB role via requireAdmin().
  if (pathname.startsWith('/admin') && user) {
    const role = user.user_metadata?.role;
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

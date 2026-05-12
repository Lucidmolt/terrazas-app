import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = request.nextUrl;

  // Public routes — no auth needed
  const publicPaths = ['/', '/login', '/terms', '/onboarding', '/auth', '/api/webhooks', '/api/cron', '/api/pricing', '/api/coverage', '/api/business'];
  if (publicPaths.some(p => pathname.startsWith(p))) return res;

  // Static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) return res;

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll().map(c => ({ name: c.name, value: c.value })), setAll: (cookies) => { cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); } } }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // Protected pages — redirect to login if no session
  const protectedPages = ['/dashboard', '/pro', '/admin', '/post', '/account'];
  if (!session && protectedPages.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Admin pages — check role
  if (pathname.startsWith('/admin') && session) {
    // For now, admin check will happen client-side
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

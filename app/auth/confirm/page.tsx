'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Suspense } from 'react';

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'customer';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const supabase = createClient();

    // Supabase Auth handles the token exchange automatically via the URL hash
    // We just need to check if the session is now valid
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        setStatus('error');
        setErrorMsg(error.message);
        return;
      }

      if (session) {
        // Sync user to our database
        try {
          await fetch('/api/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'SIGNED_IN', session }),
          });
        } catch {
          // Non-fatal — user is still authenticated
        }

        setStatus('success');
        setTimeout(() => {
          router.push(role === 'pro' ? '/pro' : '/');
        }, 1500);
      } else {
        setStatus('error');
        setErrorMsg('No session found. The link may have expired.');
      }
    };

    checkSession();
  }, [router, role]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6 animate-fade-in">
        <h1 className="text-4xl font-black tracking-tighter text-brand-700">TERRAZAS</h1>

        {status === 'loading' && (
          <div className="glass rounded-5xl p-12 shadow-2xl border border-white space-y-4">
            <div className="text-4xl animate-spin">⏳</div>
            <p className="text-slate-500 font-medium">Confirming your login...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="glass rounded-5xl p-12 shadow-2xl border border-white space-y-4">
            <div className="text-4xl">✅</div>
            <p className="text-emerald-700 font-bold text-lg">You&apos;re signed in!</p>
            <p className="text-slate-500 text-sm">Redirecting...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="glass rounded-5xl p-12 shadow-2xl border border-white space-y-4">
            <div className="text-4xl">❌</div>
            <p className="text-red-700 font-bold text-lg">Login failed</p>
            <p className="text-slate-500 text-sm">{errorMsg}</p>
            <a href="/login" className="inline-block mt-4 px-6 py-3 bg-brand-600 text-white rounded-3xl font-bold hover:bg-brand-700 transition-all">
              Try Again
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>}>
      <ConfirmContent />
    </Suspense>
  );
}

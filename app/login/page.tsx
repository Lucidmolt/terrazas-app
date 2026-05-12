'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get('role') || 'customer';

  const [role, setRole] = useState<'customer' | 'pro'>(defaultRole === 'pro' ? 'pro' : 'customer');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const supabase = createClient();

  const handleCustomerLogin = async () => {
    if (!email) return;
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        data: { role: 'customer' },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setMessage('✅ Magic link sent! Check your email and click the link to sign in.');
    setLoading(false);
  };

  const handleProLogin = async () => {
    if (!phone) return;
    setLoading(true);
    setError('');

    // Format phone to E.164
    const formattedPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;

    const { error: authError } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
      options: {
        data: { role: 'pro' },
      },
    });

    if (authError) {
      // If SMS isn't configured, fall back to email-based pro login
      if (authError.message.includes('not enabled') || authError.message.includes('provider')) {
        setError('SMS login not yet available. Please use email login for now.');
        setLoading(false);
        return;
      }
      setError(authError.message);
      setLoading(false);
      return;
    }

    setMessage('✅ Verification code sent! Enter the 6-digit code below.');
    setLoading(false);
  };

  const handleEmailProLogin = async () => {
    if (!email) return;
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?role=pro`,
        data: { role: 'pro' },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setMessage('✅ Magic link sent! Check your email and click the link to sign in.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <a href="/"><h1 className="text-4xl font-black tracking-tighter text-brand-700">TERRAZAS</h1></a>
          <p className="text-slate-500 font-medium text-sm">
            {role === 'customer' ? 'Sign in to book lawn care' : 'Sign in to your Pro dashboard'}
          </p>
        </div>

        {/* Role Toggle */}
        <div className="flex bg-white rounded-4xl p-1 border border-slate-100 shadow-sm">
          <button onClick={() => { setRole('customer'); setMessage(''); setError(''); }}
            className={`flex-1 py-3 rounded-[1.8rem] text-sm font-bold transition-all ${role === 'customer' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
            Customer
          </button>
          <button onClick={() => { setRole('pro'); setMessage(''); setError(''); }}
            className={`flex-1 py-3 rounded-[1.8rem] text-sm font-bold transition-all ${role === 'pro' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
            Pro / Provider
          </button>
        </div>

        <div className="glass rounded-5xl p-8 shadow-2xl border border-white space-y-6">
          {role === 'customer' ? (
            <>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomerLogin()}
                  className="w-full px-5 py-4 rounded-3xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
                <p className="text-[10px] text-slate-400 font-medium ml-4">We&apos;ll send a magic link — no password needed.</p>
              </div>
              <button
                onClick={handleCustomerLogin}
                disabled={loading || !email}
                className="w-full py-4 rounded-3xl bg-brand-600 text-white font-bold text-base shadow-lg hover:shadow-xl hover:bg-brand-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
                {loading ? '⏳ Sending...' : '✨ Send Magic Link'}
              </button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  placeholder="pro@business.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailProLogin()}
                  className="w-full px-5 py-4 rounded-3xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
                <p className="text-[10px] text-slate-400 font-medium ml-4">Sign in with your registered email address.</p>
              </div>
              <button
                onClick={handleEmailProLogin}
                disabled={loading || !email}
                className="w-full py-4 rounded-3xl bg-emerald-600 text-white font-bold text-base shadow-lg hover:shadow-xl hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
                {loading ? '⏳ Sending...' : '🔐 Send Pro Login Link'}
              </button>
            </>
          )}

          {/* Messages */}
          {message && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
              <p className="text-sm text-emerald-700 font-medium">{message}</p>
            </div>
          )}
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
              <p className="text-sm text-red-700 font-medium">⚠️ {error}</p>
            </div>
          )}

          {/* Sign up link */}
          <div className="text-center pt-2">
            <p className="text-xs text-slate-400">
              {role === 'customer' ? (
                <>New here? Just enter your email — we&apos;ll create your account automatically.</>
              ) : (
                <>Want to join as a provider? <a href="/onboarding?role=pro" className="text-emerald-600 font-bold hover:underline">Apply here →</a></>
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-400">
          By signing in you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>}>
      <LoginContent />
    </Suspense>
  );
}

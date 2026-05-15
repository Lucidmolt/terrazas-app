'use client';

import React, { Suspense, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get('role') || 'customer';

  const [role, setRole] = useState<'customer' | 'pro'>(defaultRole === 'pro' ? 'pro' : 'customer');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const supabase = createClient();

  // ── Send OTP Code ────────────────────────────────────────────────
  const sendOtp = async () => {
    if (!email) return;
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { role },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setOtpSent(true);
    setMessage('');
    setLoading(false);
    // Focus first OTP input
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  // ── Handle OTP Input ─────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only take last digit
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (newOtp.every(d => d !== '') && newOtp.join('').length === 6) {
      verifyOtp(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ── Handle Paste ─────────────────────────────────────────────────
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newOtp = pasted.split('');
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
      verifyOtp(pasted);
    }
  };

  // ── Verify OTP Code ──────────────────────────────────────────────
  const verifyOtp = async (code: string) => {
    setLoading(true);
    setError('');

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });

    if (verifyError) {
      setError(verifyError.message);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setLoading(false);
      return;
    }

    if (data.session) {
      // Sync user to Prisma database
      try {
        await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'SIGNED_IN', session: data.session }),
        });
      } catch {
        // Non-fatal
      }

      setMessage('✅ Verified! Redirecting...');
      setTimeout(() => {
        router.push(role === 'pro' ? '/pro' : '/');
      }, 1000);
    } else {
      setError('Verification failed. Please try again.');
      setOtp(['', '', '', '', '', '']);
      setLoading(false);
    }
  };

  // ── Resend Code ──────────────────────────────────────────────────
  const resendCode = async () => {
    setOtp(['', '', '', '', '', '']);
    setError('');
    await sendOtp();
    setMessage('✅ New code sent!');
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
          <button onClick={() => { setRole('customer'); setMessage(''); setError(''); setOtpSent(false); setOtp(['','','','','','']); }}
            className={`flex-1 py-3 rounded-[1.8rem] text-sm font-bold transition-all ${role === 'customer' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
            Customer
          </button>
          <button onClick={() => { setRole('pro'); setMessage(''); setError(''); setOtpSent(false); setOtp(['','','','','','']); }}
            className={`flex-1 py-3 rounded-[1.8rem] text-sm font-bold transition-all ${role === 'pro' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
            Pro / Provider
          </button>
        </div>

        <div className="glass rounded-5xl p-8 shadow-2xl border border-white space-y-6">
          {!otpSent ? (
            <>
              {/* Email Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  placeholder={role === 'customer' ? 'you@example.com' : 'pro@business.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
                  className={`w-full px-5 py-4 rounded-3xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                    role === 'customer' ? 'focus:ring-brand-500' : 'focus:ring-emerald-500'
                  }`}
                />
                <p className="text-[10px] text-slate-400 font-medium ml-4">We&apos;ll send a 6-digit verification code to your email.</p>
              </div>
              <button
                onClick={sendOtp}
                disabled={loading || !email}
                className={`w-full py-4 rounded-3xl text-white font-bold text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${
                  role === 'customer'
                    ? 'bg-brand-600 hover:bg-brand-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}>
                {loading ? '⏳ Sending...' : '🔐 Send Verification Code'}
              </button>
            </>
          ) : (
            <>
              {/* OTP Input */}
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-700">Enter the 6-digit code sent to</p>
                  <p className="text-sm text-slate-500 font-medium">{email}</p>
                </div>

                <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-2xl font-black rounded-2xl border-2 bg-white transition-all focus:outline-none ${
                        digit
                          ? role === 'customer' ? 'border-brand-500 text-brand-700' : 'border-emerald-500 text-emerald-700'
                          : 'border-slate-200 text-slate-900'
                      } ${role === 'customer' ? 'focus:border-brand-500 focus:ring-2 focus:ring-brand-200' : 'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'}`}
                      disabled={loading}
                    />
                  ))}
                </div>

                <div className="text-center space-y-2">
                  <button
                    onClick={resendCode}
                    disabled={loading}
                    className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
                    Didn&apos;t get it? <span className="font-bold underline">Resend code</span>
                  </button>
                  <br />
                  <button
                    onClick={() => { setOtpSent(false); setOtp(['','','','','','']); setError(''); }}
                    className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
                    ← Use a different email
                  </button>
                </div>
              </div>

              {loading && (
                <div className="text-center">
                  <div className="text-2xl animate-spin inline-block">⏳</div>
                  <p className="text-sm text-slate-500 mt-2">Verifying...</p>
                </div>
              )}
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
          {!otpSent && (
            <div className="text-center pt-2">
              <p className="text-xs text-slate-400">
                {role === 'customer' ? (
                  <>New here? Just enter your email — we&apos;ll create your account automatically.</>
                ) : (
                  <>Want to join as a provider? <a href="/onboarding?role=pro" className="text-emerald-600 font-bold hover:underline">Apply here →</a></>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-400">
          By signing in you agree to our <a href="/terms" className="underline">Terms of Service</a> and Privacy Policy.
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

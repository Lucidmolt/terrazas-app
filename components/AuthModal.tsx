'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

type ModalView = 'choose' | 'create-role' | 'signin' | 'signup' | 'otp';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'choose' | 'signin' | 'signup';
}

export default function AuthModal({ isOpen, onClose, initialView = 'choose' }: AuthModalProps) {
  const router = useRouter();
  const supabase = createClient();

  const [view, setView] = useState<ModalView>(initialView);
  const [role, setRole] = useState<'customer' | 'pro'>('customer');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isNewUser, setIsNewUser] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      setEmail('');
      setError('');
      setMessage('');
      setOtp(['', '', '', '', '', '']);
      setLoading(false);
    }
  }, [isOpen, initialView]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  // ── Send OTP ────────────────────────────────────────────────────────
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

    setView('otp');
    setMessage('');
    setLoading(false);
    setTimeout(() => inputRefs.current[0]?.focus(), 150);
  };

  // ── OTP Input Handlers ──────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(d => d !== '') && newOtp.join('').length === 6) {
      verifyOtp(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
      verifyOtp(pasted);
    }
  };

  // ── Verify OTP ──────────────────────────────────────────────────────
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
      // Sync to Prisma DB
      try {
        const res = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'SIGNED_IN' }),
        });
        const result = await res.json();
        setIsNewUser(result.isNewUser);
      } catch {
        // Non-fatal
      }

      setMessage('✅ Verified! Redirecting...');

      setTimeout(() => {
        onClose();
        if (isNewUser && role === 'pro') {
          router.push('/onboarding?role=pro');
        } else if (role === 'pro') {
          router.push('/pro');
        } else if (isNewUser) {
          router.push('/onboarding?role=customer');
        } else {
          router.push('/dashboard');
        }
      }, 800);
    } else {
      setError('Verification failed. Please try again.');
      setOtp(['', '', '', '', '', '']);
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setOtp(['', '', '', '', '', '']);
    setError('');
    await sendOtp();
    setMessage('✅ New code sent!');
  };

  if (!isOpen) return null;

  const accentColor = role === 'pro' ? 'emerald' : 'brand';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center"
      onClick={handleBackdropClick}
      style={{ animation: 'fadeIn 0.2s ease-out' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-white rounded-t-[2rem] md:rounded-[2rem] shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Drag handle (mobile) */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 md:hidden" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all z-10"
        >
          ✕
        </button>

        <div className="p-6 pb-8 md:p-8 space-y-6">
          {/* ─── CHOOSE: Sign In or Create Account ─── */}
          {view === 'choose' && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center space-y-2 pt-2">
                <h2 className="text-2xl font-black tracking-tighter text-slate-900">Welcome to Terrazas</h2>
                <p className="text-sm text-slate-500 font-medium">Book lawn care instantly, or offer your services.</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => { setView('signin'); setRole('customer'); }}
                  className="w-full p-5 bg-brand-600 text-white rounded-[1.5rem] flex items-center space-x-4 shadow-lg shadow-brand-200 active:scale-[0.98] transition-all"
                >
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">🔑</div>
                  <div className="text-left flex-1">
                    <div className="font-black text-base">Sign In</div>
                    <div className="text-[11px] opacity-80 font-medium">Already have an account</div>
                  </div>
                  <div className="text-white/60 text-lg">→</div>
                </button>

                <button
                  onClick={() => setView('create-role')}
                  className="w-full p-5 bg-white border-2 border-slate-100 rounded-[1.5rem] flex items-center space-x-4 hover:border-slate-300 active:scale-[0.98] transition-all"
                >
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl">✨</div>
                  <div className="text-left flex-1">
                    <div className="font-black text-base text-slate-900">Create Account</div>
                    <div className="text-[11px] text-slate-400 font-medium">New to Terrazas? Sign up free</div>
                  </div>
                  <div className="text-slate-300 text-lg">→</div>
                </button>
              </div>

              <p className="text-center text-[10px] text-slate-400">
                By continuing you agree to our <a href="/terms" className="underline">Terms</a> and Privacy Policy.
              </p>
            </div>
          )}

          {/* ─── CREATE ACCOUNT: Choose Role ─── */}
          {view === 'create-role' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center space-x-3">
                <button onClick={() => setView('choose')} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 hover:bg-slate-200 transition-colors">←</button>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900">I am a...</h2>
                  <p className="text-xs text-slate-400 font-medium">Choose your account type</p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => { setRole('customer'); setIsNewUser(true); setView('signup'); }}
                  className="w-full p-5 bg-white border-2 border-slate-100 rounded-[1.5rem] flex items-center space-x-4 hover:border-brand-400 hover:bg-brand-50/30 active:scale-[0.98] transition-all group"
                >
                  <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🏡</div>
                  <div className="text-left flex-1">
                    <div className="font-black text-base text-slate-900">Customer</div>
                    <div className="text-[11px] text-slate-400 font-medium">I need lawn care services</div>
                  </div>
                  <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-brand-500 group-hover:bg-brand-500 transition-all flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>

                <button
                  onClick={() => { setRole('pro'); setIsNewUser(true); setView('signup'); }}
                  className="w-full p-5 bg-white border-2 border-slate-100 rounded-[1.5rem] flex items-center space-x-4 hover:border-emerald-400 hover:bg-emerald-50/30 active:scale-[0.98] transition-all group"
                >
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🚜</div>
                  <div className="text-left flex-1">
                    <div className="font-black text-base text-slate-900">Business / Provider</div>
                    <div className="text-[11px] text-slate-400 font-medium">I offer lawn care services</div>
                  </div>
                  <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-emerald-500 group-hover:bg-emerald-500 transition-all flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ─── SIGN IN (Email Entry) ─── */}
          {view === 'signin' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center space-x-3">
                <button onClick={() => setView('choose')} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 hover:bg-slate-200 transition-colors">←</button>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900">Sign In</h2>
                  <p className="text-xs text-slate-400 font-medium">Enter your email to receive a code</p>
                </div>
              </div>

              {/* Role Toggle */}
              <div className="flex bg-slate-50 rounded-2xl p-1 border border-slate-100">
                <button onClick={() => setRole('customer')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${role === 'customer' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  Customer
                </button>
                <button onClick={() => setRole('pro')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${role === 'pro' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  Pro / Provider
                </button>
              </div>

              <EmailInput
                email={email}
                setEmail={setEmail}
                onSubmit={sendOtp}
                loading={loading}
                role={role}
                placeholder={role === 'customer' ? 'you@example.com' : 'pro@business.com'}
                buttonText="Send Verification Code"
              />

              <p className="text-center text-[10px] text-slate-400">
                Don&apos;t have an account?{' '}
                <button onClick={() => setView('create-role')} className="text-brand-600 font-bold hover:underline">Sign up →</button>
              </p>
            </div>
          )}

          {/* ─── SIGN UP (Email Entry with role preselected) ─── */}
          {view === 'signup' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center space-x-3">
                <button onClick={() => setView('create-role')} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 hover:bg-slate-200 transition-colors">←</button>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900">
                    {role === 'customer' ? 'Customer Sign Up' : 'Business Sign Up'}
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">We&apos;ll send a 6-digit code to verify your email</p>
                </div>
              </div>

              {/* Role indicator */}
              <div className={`flex items-center space-x-3 p-3 rounded-2xl ${role === 'pro' ? 'bg-emerald-50 border border-emerald-100' : 'bg-brand-50 border border-brand-100'}`}>
                <div className="text-2xl">{role === 'customer' ? '🏡' : '🚜'}</div>
                <div>
                  <div className={`text-xs font-black ${role === 'pro' ? 'text-emerald-700' : 'text-brand-700'}`}>
                    {role === 'customer' ? 'Customer Account' : 'Business Account'}
                  </div>
                  <div className={`text-[10px] font-medium ${role === 'pro' ? 'text-emerald-600' : 'text-brand-600'}`}>
                    {role === 'customer' ? 'Book lawn care on demand' : 'Receive jobs and earn money'}
                  </div>
                </div>
              </div>

              <EmailInput
                email={email}
                setEmail={setEmail}
                onSubmit={sendOtp}
                loading={loading}
                role={role}
                placeholder={role === 'customer' ? 'you@example.com' : 'pro@business.com'}
                buttonText="Create Account"
              />

              <p className="text-center text-[10px] text-slate-400">
                Already have an account?{' '}
                <button onClick={() => { setView('signin'); }} className="text-brand-600 font-bold hover:underline">Sign in →</button>
              </p>
            </div>
          )}

          {/* ─── OTP VERIFICATION ─── */}
          {view === 'otp' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center space-x-3">
                <button onClick={() => { setView(isNewUser ? 'signup' : 'signin'); setOtp(['','','','','','']); setError(''); }}
                  className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 hover:bg-slate-200 transition-colors">←</button>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900">Enter Code</h2>
                  <p className="text-xs text-slate-400 font-medium">Sent to {email}</p>
                </div>
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
                        ? role === 'pro' ? 'border-emerald-500 text-emerald-700' : 'border-brand-500 text-brand-700'
                        : 'border-slate-200 text-slate-900'
                    } ${role === 'pro' ? 'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200' : 'focus:border-brand-500 focus:ring-2 focus:ring-brand-200'}`}
                    disabled={loading}
                  />
                ))}
              </div>

              {loading && (
                <div className="text-center">
                  <div className="text-2xl animate-spin inline-block">⏳</div>
                  <p className="text-sm text-slate-500 mt-1">Verifying...</p>
                </div>
              )}

              <div className="text-center space-y-2">
                <button onClick={resendCode} disabled={loading}
                  className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
                  Didn&apos;t get it? <span className="font-bold underline">Resend code</span>
                </button>
                <br />
                <button onClick={() => { setView(isNewUser ? 'signup' : 'signin'); setOtp(['','','','','','']); setError(''); }}
                  className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
                  ← Use a different email
                </button>
              </div>
            </div>
          )}

          {/* ─── Status Messages ─── */}
          {message && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
              <p className="text-sm text-emerald-700 font-medium text-center">{message}</p>
            </div>
          )}
          {error && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-100">
              <p className="text-sm text-red-700 font-medium text-center">⚠️ {error}</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Reusable Email Input Block ────────────────────────────────────────
function EmailInput({
  email, setEmail, onSubmit, loading, role, placeholder, buttonText,
}: {
  email: string;
  setEmail: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  role: 'customer' | 'pro';
  placeholder: string;
  buttonText: string;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Email Address</label>
        <input
          type="email"
          placeholder={placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          className={`w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
            role === 'pro' ? 'focus:ring-emerald-500' : 'focus:ring-brand-500'
          }`}
          autoFocus
        />
      </div>
      <button
        onClick={onSubmit}
        disabled={loading || !email}
        className={`w-full py-4 rounded-2xl text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${
          role === 'pro'
            ? 'bg-emerald-600 hover:bg-emerald-700'
            : 'bg-brand-600 hover:bg-brand-700'
        }`}
      >
        {loading ? '⏳ Sending...' : buttonText}
      </button>
    </div>
  );
}

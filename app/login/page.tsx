'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get('role') || 'customer';

  const [role, setRole] = useState<'customer' | 'pro'>(defaultRole === 'pro' ? 'pro' : 'customer');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCustomerLogin = async () => {
    if (!email) return;
    setLoading(true);
    // For local dev, just redirect — real auth comes with Supabase/NextAuth later
    setMessage('✅ Demo mode — redirecting to home...');
    setTimeout(() => router.push('/'), 1500);
    setLoading(false);
  };

  const handleProLogin = async () => {
    if (!phone) return;
    setLoading(true);
    setMessage('✅ Demo mode — redirecting to Pro dashboard...');
    setTimeout(() => router.push('/pro'), 1500);
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
          <button onClick={() => { setRole('customer'); setMessage(''); }}
            className={`flex-1 py-3 rounded-[1.8rem] text-sm font-bold transition-all ${role === 'customer' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
            Customer
          </button>
          <button onClick={() => { setRole('pro'); setMessage(''); }}
            className={`flex-1 py-3 rounded-[1.8rem] text-sm font-bold transition-all ${role === 'pro' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
            Pro
          </button>
        </div>

        {/* Login Form */}
        <div className="glass rounded-5xl p-8 shadow-2xl border border-white space-y-6">
          {role === 'customer' ? (
            <>
              <div className="space-y-2">
                <label className="text-label ml-4">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomerLogin()}
                  placeholder="you@email.com" className="input-field" />
                <p className="text-[10px] text-slate-400 font-medium ml-4">We'll send a magic link — no password needed.</p>
              </div>
              <button onClick={handleCustomerLogin} disabled={loading || !email} className="btn-brand">
                {loading ? 'Sending...' : 'Send Magic Link ✉️'}
              </button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-label ml-4">Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleProLogin()}
                  placeholder="+1 (555) 000-0000" className="input-field" />
              </div>
              <button onClick={handleProLogin} disabled={loading || !phone} className="btn-primary">
                {loading ? 'Verifying...' : 'Send SMS Code 📱'}
              </button>
            </>
          )}
          {message && <p className="text-sm font-bold text-center text-brand-600 animate-fade-in">{message}</p>}

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-[10px] font-bold text-amber-700 text-center">🔧 Dev Mode: Auth is mocked. Real auth will use Magic Link / OTP when connected to Supabase.</p>
          </div>
        </div>

        <div className="text-center">
          <a href="/" className="text-micro text-slate-400 hover:text-slate-600 transition-colors">← Back to Home</a>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <LoginContent />
    </Suspense>
  );
}

'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role') || 'customer';
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Customer fields
  const [name, setName] = useState('');
  const [zip, setZip] = useState('');
  const [address, setAddress] = useState('');

  // Provider fields
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceZips, setServiceZips] = useState('');
  const [bio, setBio] = useState('');
  const [equipmentType, setEquipmentType] = useState<'residential' | 'commercial'>('residential');
  const [teamSize, setTeamSize] = useState<'solo' | 'small' | 'medium'>('solo');

  // Check if user is already onboarded
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }

      // Pre-fill name from auth metadata
      if (user.user_metadata?.name) setName(user.user_metadata.name);
      if (user.email) setName((prev) => prev || user.email!.split('@')[0]);

      // Check if already onboarded
      try {
        const res = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'CHECK' }),
        });
        const data = await res.json();
        if (data.user?.onboardedAt) {
          router.push(roleParam === 'pro' ? '/pro' : '/dashboard');
          return;
        }
      } catch {}
      setChecking(false);
    };
    checkUser();
  }, []);

  const isPro = roleParam === 'pro';
  const totalSteps = isPro ? 3 : 2;
  const progress = ((step + 1) / totalSteps) * 100;

  // ── Save Customer Onboarding ────────────────────────────────────────
  const completeCustomerOnboarding = async () => {
    setLoading(true);
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'customer',
          name,
          zipCode: zip,
          address,
        }),
      });
      router.push('/dashboard');
    } catch (err) {
      console.error('Onboarding failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Save Provider Onboarding ────────────────────────────────────────
  const completeProOnboarding = async () => {
    setLoading(true);
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'pro',
          name,
          businessName,
          phone,
          zipCodes: serviceZips.split(',').map(z => z.trim()).filter(Boolean),
          bio,
          equipmentType,
          teamSize,
        }),
      });
      router.push('/pro');
    } catch (err) {
      console.error('Onboarding failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tighter text-brand-700">TERRAZAS</h1>
        <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${isPro ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600'}`}>
          {isPro ? '🚜 Pro Setup' : '🏡 Customer Setup'}
        </span>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <div
          className={`h-full transition-all duration-500 ${isPro ? 'bg-emerald-500' : 'bg-brand-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center p-6 pt-10">
        <div className="max-w-lg w-full space-y-8">

          {/* ─── CUSTOMER FLOW ─── */}
          {!isPro && step === 0 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Welcome! 👋</h2>
                <p className="text-slate-500 font-medium text-sm">Tell us a bit about yourself so we can find the best pros near you.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Your Name</label>
                  <input type="text" placeholder="John Smith" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" autoFocus />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Zip Code</label>
                  <input type="text" placeholder="67401" maxLength={5} inputMode="numeric" value={zip}
                    onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Service Address <span className="text-slate-300">(optional)</span></label>
                  <input type="text" placeholder="123 Main St" value={address} onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" />
                </div>
              </div>
              <button onClick={() => setStep(1)} disabled={!name || zip.length < 5}
                className="w-full py-4 rounded-2xl bg-brand-600 text-white font-bold shadow-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all">
                Continue →
              </button>
            </div>
          )}

          {!isPro && step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">You&apos;re all set! 🎉</h2>
                <p className="text-slate-500 font-medium text-sm">Here&apos;s what you can do with Terrazas:</p>
              </div>
              <div className="space-y-3">
                {[
                  { emoji: '📡', title: 'Broadcast Jobs', desc: 'Post a job and nearby pros race to claim it' },
                  { emoji: '⭐', title: 'Choose Preferred Pros', desc: 'Pick a specific business you trust' },
                  { emoji: '📸', title: 'Yard Vision AI', desc: 'Snap a photo for instant yard analysis' },
                  { emoji: '💳', title: 'Secure Payments', desc: 'Pay securely through the app after the job' },
                ].map((item) => (
                  <div key={item.title} className="flex items-center space-x-4 p-4 bg-white rounded-2xl border border-slate-100">
                    <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">{item.emoji}</div>
                    <div>
                      <div className="font-bold text-sm text-slate-900">{item.title}</div>
                      <div className="text-[11px] text-slate-400 font-medium">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={completeCustomerOnboarding} disabled={loading}
                className="w-full py-4 rounded-2xl bg-brand-600 text-white font-bold shadow-lg hover:bg-brand-700 disabled:opacity-50 active:scale-[0.98] transition-all">
                {loading ? '⏳ Setting up...' : 'Start Booking →'}
              </button>
            </div>
          )}

          {/* ─── PROVIDER FLOW ─── */}
          {isPro && step === 0 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Business Info 🚜</h2>
                <p className="text-slate-500 font-medium text-sm">Set up your business profile so customers can find you.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Your Name</label>
                  <input type="text" placeholder="John Smith" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" autoFocus />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Business Name</label>
                  <input type="text" placeholder="Smith's Lawn Care" value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Phone Number</label>
                  <input type="tel" placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" />
                </div>
              </div>
              <button onClick={() => setStep(1)} disabled={!name || !businessName}
                className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold shadow-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all">
                Continue →
              </button>
            </div>
          )}

          {isPro && step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <button onClick={() => setStep(0)} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 hover:bg-slate-200 transition-colors">←</button>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Service Area</h2>
                    <p className="text-xs text-slate-400 font-medium">Where do you operate?</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Zip Codes You Serve <span className="text-slate-300">(comma separated)</span></label>
                  <input type="text" placeholder="67401, 67402, 67460" value={serviceZips} onChange={(e) => setServiceZips(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" autoFocus />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Equipment Type</label>
                  <div className="flex gap-2">
                    {(['residential', 'commercial'] as const).map((type) => (
                      <button key={type} onClick={() => setEquipmentType(type)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                          equipmentType === type
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                        }`}>
                        {type === 'residential' ? '🏡 Residential' : '🏢 Commercial'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Team Size</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'solo' as const, label: '👤 Solo', desc: 'Just me' },
                      { value: 'small' as const, label: '👥 Small', desc: '2-4 people' },
                      { value: 'medium' as const, label: '🏗️ Medium', desc: '5+ crew' },
                    ]).map((opt) => (
                      <button key={opt.value} onClick={() => setTeamSize(opt.value)}
                        className={`flex-1 py-3 rounded-xl text-xs font-bold border-2 transition-all ${
                          teamSize === opt.value
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => setStep(2)} disabled={!serviceZips}
                className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold shadow-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all">
                Continue →
              </button>
            </div>
          )}

          {isPro && step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <button onClick={() => setStep(1)} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 hover:bg-slate-200 transition-colors">←</button>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Almost There! 🎉</h2>
                    <p className="text-xs text-slate-400 font-medium">Add a short bio for customers</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Business Bio <span className="text-slate-300">(optional)</span></label>
                  <textarea placeholder="Tell customers about your business, experience, and what makes you stand out..." value={bio}
                    onChange={(e) => setBio(e.target.value)} rows={4}
                    className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none" />
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-2">
                  <div className="text-xs font-black text-emerald-700">What happens next?</div>
                  <ul className="text-[11px] text-emerald-600 font-medium space-y-1">
                    <li>• You&apos;ll start receiving job alerts in your zip codes</li>
                    <li>• Claim jobs and earn money on your schedule</li>
                    <li>• Build your reputation with reviews from customers</li>
                    <li>• Upgrade to Verified Pro tier after 20 jobs at 4.8+ rating</li>
                  </ul>
                </div>
              </div>
              <button onClick={completeProOnboarding} disabled={loading}
                className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold shadow-lg hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] transition-all">
                {loading ? '⏳ Setting up...' : 'Launch My Business →'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <OnboardingContent />
    </Suspense>
  );
}

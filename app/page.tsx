'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TIERS, BROADCAST_WINDOW_SECONDS } from '@/lib/constants';

type View = 'zip' | 'provider-choice' | 'preferred' | 'tiers' | 'searching' | 'success';

interface ProviderInfo {
  id: string;
  businessName: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  isActive: boolean;
  avatarUrl: string | null;
  ownerName: string | null;
}

export default function HomePage() {
  const [view, setView] = useState<View>('zip');
  const [zip, setZip] = useState('');
  const [activeZip, setActiveZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [providerCount, setProviderCount] = useState(0);
  const [selectedTier, setSelectedTier] = useState<'basic' | 'premium'>('premium');
  const [address, setAddress] = useState('');
  const [countdown, setCountdown] = useState(BROADCAST_WINDOW_SECONDS);
  const [countdownActive, setCountdownActive] = useState(false);
  const [mapScale, setMapScale] = useState(1);
  const [pinVisible, setPinVisible] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  // ── Broadcast Countdown Timer ────────────────────────────────────
  useEffect(() => {
    if (!countdownActive || countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { setCountdownActive(false); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdownActive, countdown]);

  // ── Poll for Job Claim (replaces Supabase realtime) ──────────────
  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs?customerId=demo`);
        const data = await res.json();
        const job = data.jobs?.find((j: any) => j.id === jobId);
        if (job && (job.status === 'active' || job.status === 'en_route')) {
          setView('success');
          setCountdownActive(false);
        }
      } catch { /* polling failure is non-fatal */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [jobId]);

  // ── Check Zip Code & Fetch Providers ─────────────────────────────
  const checkZip = useCallback(async () => {
    if (zip.length < 5) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/providers?zip=${zip}`);
      const data = await res.json();

      setActiveZip(zip);
      setProviders(data.providers || []);
      setProviderCount(data.count || 0);
      setView('provider-choice');
      setMapScale(1.2);
      setPinVisible(true);
    } catch (err) {
      console.error('[Terrazas] checkZip failed:', err);
    } finally {
      setLoading(false);
    }
  }, [zip]);

  // ── Confirm Broadcast Order ──────────────────────────────────────
  const confirmBroadcast = useCallback(async () => {
    setLoading(true);
    try {
      const tier = TIERS[selectedTier];
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: 'demo-customer', // TODO: replace with real auth
          zipCode: activeZip,
          address: address || `Service in ${activeZip}`,
          tier: selectedTier,
          serviceType: 'mowing',
          price: tier.basePrice,
        }),
      });
      const data = await res.json();
      if (data.job) {
        setJobId(data.job.id);
        setView('searching');
        setCountdown(BROADCAST_WINDOW_SECONDS);
        setCountdownActive(true);
      }
    } catch (err) {
      console.error('[Terrazas] confirmBroadcast failed:', err);
    } finally {
      setLoading(false);
    }
  }, [activeZip, address, selectedTier]);

  // ── Select Specific Provider ─────────────────────────────────────
  const selectSpecificPro = useCallback(
    async (provider: ProviderInfo) => {
      setLoading(true);
      try {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: 'demo-customer',
            zipCode: activeZip,
            address: address || `Service in ${activeZip}`,
            tier: selectedTier,
            serviceType: 'mowing',
            price: TIERS[selectedTier].basePrice,
            providerId: provider.id,
          }),
        });
        const data = await res.json();
        if (data.job) {
          setJobId(data.job.id);
          setView('success');
        }
      } catch (err) {
        console.error('[Terrazas] selectSpecificPro failed:', err);
      } finally {
        setLoading(false);
      }
    },
    [activeZip, address, selectedTier]
  );

  const goHome = useCallback(() => {
    setView('zip');
    setMapScale(1);
    setPinVisible(false);
    setZip('');
    setActiveZip('');
    setJobId(null);
    setCountdownActive(false);
    setCountdown(BROADCAST_WINDOW_SECONDS);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-white relative">
      {/* Map Background */}
      <div className="absolute inset-0 z-0 transition-all duration-1000 origin-center" style={{ transform: `scale(${mapScale})` }}>
        <div className="absolute inset-0 bg-slate-200">
          <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1200&q=80" className="w-full h-full object-cover grayscale-[20%] opacity-40" alt="Map" />
          <div className="map-gradient absolute inset-0 pointer-events-none" />
        </div>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-500 ${pinVisible ? 'scale-100' : 'scale-0'}`}>
          <div className="relative">
            <div className="absolute -inset-6 bg-brand-500/20 rounded-full animate-ping" />
            <div className="w-6 h-6 bg-brand-600 rounded-full border-4 border-white shadow-2xl" />
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="relative z-30 px-6 py-5 glass border-b border-slate-100 flex items-center justify-between">
        <button onClick={goHome} className="cursor-pointer">
          <h1 className="text-2xl font-black tracking-tighter text-brand-700 leading-none">TERRAZAS</h1>
        </button>
        <div className="flex items-center space-x-4">
          {activeZip && (
            <div className="hidden md:flex flex-col text-right">
              <span className="text-micro text-slate-400">Service Zone</span>
              <span className="text-xs font-black text-slate-900">{activeZip}</span>
            </div>
          )}
          <a href="/login" className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-4xl border border-slate-100 hover:border-brand-300 transition-colors">
            <span className="text-xs font-bold px-2">Sign In</span>
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white text-xs font-bold">→</div>
          </a>
        </div>
      </header>

      {/* Drawer */}
      <main className="relative z-20 flex-1 flex flex-col justify-end md:justify-start pointer-events-none">
        <div className="drawer pointer-events-auto p-6 pb-10 transition-all duration-500 overflow-y-auto no-scrollbar">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto -mt-3 mb-6 md:hidden" />

          {/* ZIP ENTRY */}
          {view === 'zip' && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Enter Area Code</h2>
                <p className="text-slate-500 font-bold text-sm">We'll check for active partners in your zone.</p>
              </div>
              <div className="relative group">
                <input type="text" maxLength={5} inputMode="numeric" placeholder="Zip Code" value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && checkZip()}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-4xl p-6 text-2xl font-black tracking-[0.2em] placeholder:text-slate-300 focus:bg-white focus:border-brand-500 focus:outline-none transition-all shadow-inner" />
                <button onClick={checkZip} disabled={zip.length < 5 || loading}
                  className="absolute right-3 top-3 bottom-3 bg-brand-600 text-white px-8 rounded-4xl font-black text-xs shadow-xl shadow-brand-200 active:scale-95 transition-all disabled:bg-slate-300 disabled:shadow-none">
                  {loading ? '...' : 'GO'}
                </button>
              </div>
              <input type="text" placeholder="Service Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} className="input-field text-sm" />
              <a href="/yard-vision" className="w-full bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-5xl p-5 flex items-center justify-between group hover:border-brand-400 transition-all active:scale-95 block">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-white rounded-4xl flex items-center justify-center text-3xl shadow-sm">📸</div>
                  <div className="text-left">
                    <div className="text-sm font-black text-slate-900 tracking-tight">Yard Vision AI</div>
                    <div className="text-micro text-slate-500">Snap a photo for instant condition scan</div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm">→</div>
              </a>
              <div className="p-5 bg-brand-50/50 rounded-5xl border border-brand-100/50">
                <h3 className="text-xs font-black text-brand-800 uppercase tracking-widest mb-2">Why Terrazas?</h3>
                <p className="text-[11px] font-bold text-brand-700 leading-relaxed">Instantly book verified lawn professionals. No phone calls, no waiting for quotes.</p>
              </div>
            </div>
          )}

          {/* PROVIDER CHOICE */}
          {view === 'provider-choice' && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Active in <span className="text-brand-600">{activeZip}</span></h2>
                <p className="text-label">How would you like to book?</p>
              </div>
              <div className="space-y-3">
                <button onClick={() => setView('preferred')} className="w-full p-5 bg-white border-2 border-slate-100 rounded-4xl flex items-center space-x-4 text-left hover:border-brand-500 transition-all">
                  <div className="w-14 h-14 bg-brand-50 rounded-4xl flex items-center justify-center text-3xl">⭐</div>
                  <div className="flex-1">
                    <div className="font-black text-slate-800">Select Preferred</div>
                    <div className="text-micro text-slate-400">Pick a specific business</div>
                  </div>
                </button>
                <button onClick={() => setView('tiers')} className="w-full p-5 bg-brand-600 text-white rounded-4xl flex items-center space-x-4 shadow-xl shadow-brand-100 active:scale-95 transition-all text-left">
                  <div className="w-14 h-14 bg-white/20 rounded-4xl flex items-center justify-center text-3xl relative">📡<div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-brand-600 animate-pulse" /></div>
                  <div className="flex-1">
                    <div className="font-black">Broadcast Job</div>
                    <div className="text-micro opacity-80">Instant Dispatch • {providerCount > 0 ? `${providerCount} Pros Active` : 'Network Search'}</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* PREFERRED PROVIDERS */}
          {view === 'preferred' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button onClick={() => setView('provider-choice')} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-bold">←</button>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Preferred Pros</h2>
                </div>
                <span className="badge badge-verified">Verified</span>
              </div>
              <div className="space-y-2 overflow-y-auto max-h-[40vh] no-scrollbar">
                {providers.length > 0 ? providers.map((pro) => (
                  <button key={pro.id} onClick={() => selectSpecificPro(pro)} disabled={!pro.isActive}
                    className={`provider-card w-full text-left ${!pro.isActive ? 'provider-card-offline' : ''}`}>
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-xl font-bold text-brand-600">
                      {pro.businessName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <div className="font-black text-slate-800">{pro.businessName}</div>
                      <div className="text-micro text-brand-600">{pro.rating ? `${pro.rating} ★ (${pro.reviewCount})` : 'New'} • {pro.isActive ? 'Active' : 'Offline'}</div>
                    </div>
                    {!pro.isActive && <span className="badge badge-offline">Offline</span>}
                  </button>
                )) : (
                  <div className="p-6 text-center text-slate-400"><p className="text-4xl mb-3">🔍</p><p className="font-bold text-sm">No preferred providers in {activeZip} yet.</p></div>
                )}
              </div>
            </div>
          )}

          {/* SERVICE TIERS */}
          {view === 'tiers' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button onClick={() => setView('provider-choice')} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-bold">←</button>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Service Tier</h2>
                </div>
                <span className="badge badge-verified">Licensed</span>
              </div>
              <div className="space-y-2 overflow-y-auto max-h-[35vh] no-scrollbar">
                {(Object.keys(TIERS) as Array<'basic' | 'premium'>).map((key) => {
                  const tier = TIERS[key];
                  const isSelected = selectedTier === key;
                  return (
                    <button key={key} onClick={() => setSelectedTier(key)}
                      className={`tier-card w-full text-left ${isSelected ? 'tier-card-selected' : 'tier-card-unselected'}`}>
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${isSelected ? 'bg-brand-600 text-white' : 'bg-slate-50'}`}>{tier.emoji}</div>
                        <div>
                          <div className={`font-black ${isSelected ? 'text-brand-900' : 'text-slate-800'}`}>{tier.name}</div>
                          <div className={`text-[9px] font-bold uppercase tracking-widest ${isSelected ? 'text-brand-600' : 'text-slate-400'}`}>{tier.description}</div>
                          {isSelected && <div className="mt-2 flex flex-wrap gap-1">{tier.includes.map((item) => <span key={item} className="text-[8px] bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-bold">{item}</span>)}</div>}
                        </div>
                      </div>
                      <div className={`font-black text-lg ${isSelected ? 'text-brand-900' : 'text-slate-800'}`}>${tier.basePrice}</div>
                    </button>
                  );
                })}
              </div>
              <button onClick={confirmBroadcast} disabled={loading} className="btn-primary">{loading ? 'DISPATCHING...' : 'ORDER NOW ⚡️'}</button>
            </div>
          )}

          {/* BROADCASTING */}
          {view === 'searching' && (
            <div className="space-y-8 animate-fade-in text-center">
              <div className="relative w-32 h-32 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin" />
                <div className="absolute inset-4 rounded-full bg-brand-500/10 flex items-center justify-center text-4xl">📡</div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Broadcasting Order</h2>
                <p className="text-sm text-slate-500 font-bold px-6">Notifying pros within 20 miles of <span className="font-black text-brand-600">{activeZip}</span>.</p>
              </div>
              <div className="bg-slate-50/50 rounded-4xl p-6 border border-slate-100">
                <div className="text-label mb-1">Claim Window</div>
                <div className="text-4xl font-black text-brand-600 tabular-nums tracking-tighter">{countdown > 0 ? formatTime(countdown) : 'Expanding Search...'}</div>
              </div>
              <div className="text-[11px] text-slate-400 font-bold italic">"Pros typically claim within 3 minutes."</div>
              <button onClick={goHome} className="text-slate-400 font-black text-micro hover:text-slate-600 transition-colors">Cancel & Return</button>
            </div>
          )}

          {/* SUCCESS */}
          {view === 'success' && (
            <div className="space-y-8 animate-scale-in text-center">
              <div className="relative w-32 h-32 mx-auto">
                <div className="absolute inset-0 bg-brand-500/20 rounded-full animate-ping" />
                <div className="relative w-full h-full bg-brand-600 rounded-full flex items-center justify-center text-5xl text-white shadow-xl">🚜</div>
              </div>
              <div className="space-y-1">
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Job Dispatched!</h3>
                <p className="text-slate-500 font-medium px-8 leading-relaxed">
                  We've alerted <span className="font-black text-brand-600">{providerCount > 0 ? `${providerCount} Pros` : 'our network'}</span> near <span className="font-black">{activeZip}</span>.
                </p>
              </div>
              <div className="p-5 bg-slate-50 rounded-4xl border border-slate-100 flex items-center justify-center space-x-3">
                <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
                <span className="text-label">Searching for first claim...</span>
              </div>
              <button onClick={goHome} className="text-slate-400 font-black text-micro">Cancel Request</button>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="relative z-30 p-4 pb-10 bg-white border-t border-slate-50 flex justify-around items-center shrink-0 safe-bottom md:hidden">
        <button onClick={goHome} className="w-14 h-14 flex items-center justify-center rounded-4xl bg-brand-50 text-brand-600">🏠</button>
        <a href="/track" className="w-14 h-14 flex items-center justify-center rounded-4xl text-slate-300 hover:text-brand-500 transition-colors">🗓️</a>
        <a href="/login" className="w-14 h-14 flex items-center justify-center rounded-4xl text-slate-300 hover:text-brand-500 transition-colors">👤</a>
      </nav>

      {/* Loader */}
      {loading && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-2xl z-[100] flex items-center justify-center flex-col space-y-4 animate-fade-in">
          <div className="w-14 h-14 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-micro text-brand-900 tracking-[0.4em]">Connecting</div>
        </div>
      )}
    </div>
  );
}

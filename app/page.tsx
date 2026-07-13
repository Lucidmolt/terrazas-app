'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AuthModal from '@/components/AuthModal';
import { BUSINESS, SERVICES, SERVICE_AREAS, isZipServed } from '@/lib/business';
import { ShieldCheck, Phone, Star, MapPin, ArrowRight, Camera, CalendarCheck, ClipboardList, Truck } from 'lucide-react';

export default function HomePage() {
  const [zip, setZip] = useState('');
  const [zipResult, setZipResult] = useState<'served' | 'unserved' | null>(null);
  const [authModalConfig, setAuthModalConfig] = useState<{
    isOpen: boolean;
    initialRole?: 'customer' | 'pro';
    initialView?: 'choose' | 'signin' | 'signup';
  }>({ isOpen: false });

  const openAuth = useCallback((role?: 'customer' | 'pro', view?: 'choose' | 'signin' | 'signup') => {
    setAuthModalConfig({ isOpen: true, initialRole: role, initialView: view });
  }, []);

  // Handle ?login=true (401 redirects) and persist a Yard Vision scan score for /post
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === 'true') openAuth('customer', 'signin');
    const scan = params.get('scan');
    if (scan) localStorage.setItem('terrazas_scan_score', scan);
  }, [openAuth]);

  const checkZip = useCallback(() => {
    if (zip.length < 5) return;
    setZipResult(isZipServed(zip) ? 'served' : 'unserved');
  }, [zip]);

  const bookService = (serviceId: string) => {
    const params = new URLSearchParams({ service: serviceId });
    if (zip.length === 5) params.set('zip', zip);
    window.location.href = `/post?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-40 glass border-b border-slate-100 px-5 md:px-10 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <h1 className="text-xl md:text-2xl font-black tracking-tighter text-brand-700 leading-none">TERRAZAS</h1>
          <span className="hidden sm:inline bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider">
            Lawn Care &amp; Tree Service
          </span>
        </div>
        <div className="flex items-center space-x-2.5">
          <a href={BUSINESS.phoneHref}
            className="hidden md:flex items-center space-x-2 text-xs font-black text-slate-700 hover:text-brand-700 px-3 py-2 rounded-xl border border-slate-200 bg-white shadow-sm transition-colors">
            <Phone className="w-3.5 h-3.5" />
            <span>{BUSINESS.phone}</span>
          </a>
          <button onClick={() => openAuth('customer', 'signin')}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-2 border border-slate-200 hover:border-slate-300 rounded-xl transition-all cursor-pointer bg-white shadow-sm">
            Sign In
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 md:px-10 pb-28 md:pb-16">
        {/* ── Hero ── */}
        <section className="pt-12 md:pt-20 pb-10 text-center md:text-left md:flex md:items-center md:space-x-12">
          <div className="md:flex-1 space-y-5">
            <div className="inline-flex items-center space-x-2 bg-brand-50 border border-brand-100 rounded-full px-4 py-1.5">
              <MapPin className="w-3.5 h-3.5 text-brand-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-700">Serving Southwest Kansas &amp; the Panhandles</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.05]">
              Lawn &amp; tree work,<br />
              <span className="text-brand-600">booked in a minute.</span>
            </h2>
            <p className="text-slate-500 text-sm md:text-base font-medium leading-relaxed max-w-md mx-auto md:mx-0">
              {BUSINESS.name} — family-owned and operated for {BUSINESS.yearsInBusiness} years out of {BUSINESS.city}.
              Schedule a mow at a flat price, or send us photos and get a free quote for bigger jobs.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start pt-1">
              <button onClick={() => bookService('mowing')}
                className="bg-brand-600 hover:bg-brand-700 text-white font-black text-sm px-7 py-4 rounded-4xl shadow-xl shadow-brand-200 active:scale-95 transition-all flex items-center justify-center space-x-2">
                <span>Book Lawn Mowing</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <a href="/post"
                className="bg-slate-900 hover:bg-slate-800 text-white font-black text-sm px-7 py-4 rounded-4xl active:scale-95 transition-all flex items-center justify-center space-x-2">
                <span>Get a Free Quote</span>
              </a>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center md:justify-start pt-3 text-[11px] font-bold text-slate-500">
              <span className="flex items-center space-x-1.5"><ShieldCheck className="w-4 h-4 text-brand-600" /><span>Licensed &amp; Insured</span></span>
              <span className="flex items-center space-x-1.5"><Star className="w-4 h-4 text-brand-600" /><span>Family-Owned {BUSINESS.yearsInBusiness} Years</span></span>
              <span className="flex items-center space-x-1.5"><Camera className="w-4 h-4 text-brand-600" /><span>Before &amp; After Photos</span></span>
            </div>
          </div>

          {/* Zip checker card */}
          <div className="hidden md:block md:w-[340px] shrink-0">
            <ZipCard zip={zip} setZip={setZip} zipResult={zipResult} checkZip={checkZip} bookService={bookService} />
          </div>
        </section>

        {/* Zip checker (mobile) */}
        <section className="md:hidden mb-10">
          <ZipCard zip={zip} setZip={setZip} zipResult={zipResult} checkZip={checkZip} bookService={bookService} />
        </section>

        {/* ── Services ── */}
        <section className="py-10 border-t border-slate-100">
          <div className="mb-6">
            <h3 className="text-2xl font-black tracking-tight">What do you need done?</h3>
            <p className="text-slate-500 text-sm font-medium mt-1">Flat-rate mowing books instantly. Everything else gets a free quote — usually same day.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SERVICES.map((s) => (
              <button key={s.id} onClick={() => bookService(s.id)}
                className="p-5 bg-white border-2 border-slate-100 rounded-4xl text-left hover:border-brand-500 active:scale-[0.98] transition-all group">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 bg-brand-50 rounded-3xl flex items-center justify-center text-2xl mb-3">{s.emoji}</div>
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${s.mode === 'book' ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-700'}`}>
                    {s.mode === 'book' ? 'Instant Price' : 'Free Quote'}
                  </span>
                </div>
                <div className="font-black text-slate-900 text-sm tracking-tight">{s.name}</div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">{s.blurb}</p>
                <div className="text-[10px] font-black text-brand-600 mt-3 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>{s.mode === 'book' ? 'Book now' : 'Request quote'}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="py-10 border-t border-slate-100">
          <h3 className="text-2xl font-black tracking-tight mb-6">How it works</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: <ClipboardList className="w-5 h-5" />, title: '1. Tell us about the job', body: 'Pick a service, drop your address, add photos and a preferred day. Takes about a minute.' },
              { icon: <CalendarCheck className="w-5 h-5" />, title: '2. We confirm or quote', body: 'Mowing is a flat rate, confirmed right away. Tree and landscape work gets a free quote you approve first.' },
              { icon: <Truck className="w-5 h-5" />, title: '3. We show up & prove it', body: 'Track the crew on service day and get completion photos when the work is done. Pay after the job.' },
            ].map((step) => (
              <div key={step.title} className="p-6 bg-slate-50/60 rounded-4xl border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-white border border-brand-100 flex items-center justify-center text-brand-600 mb-4 shadow-sm">{step.icon}</div>
                <h4 className="text-sm font-black tracking-tight">{step.title}</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1.5">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Yard Vision ── */}
        <section className="py-6">
          <a href="/yard-vision"
            className="w-full bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-5xl p-6 flex items-center justify-between hover:border-brand-400 transition-all active:scale-[0.99] block">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-white rounded-4xl flex items-center justify-center text-3xl shadow-sm">📸</div>
              <div className="text-left">
                <div className="text-sm font-black text-slate-900 tracking-tight">Yard Vision AI</div>
                <div className="text-micro text-slate-500">Snap a photo of your yard for an instant condition scan</div>
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm shrink-0">→</div>
          </a>
        </section>

        {/* ── Service area ── */}
        <section className="py-10 border-t border-slate-100">
          <h3 className="text-2xl font-black tracking-tight mb-2">Where we work</h3>
          <p className="text-slate-500 text-sm font-medium mb-5">Based in {BUSINESS.city} — serving communities across three states.</p>
          <div className="flex flex-wrap gap-2">
            {SERVICE_AREAS.map((a) => (
              <span key={`${a.town}-${a.state}`} className="px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-700">
                {a.town}, {a.state}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-4">
            Don&apos;t see your town? Call <a href={BUSINESS.phoneHref} className="font-black text-brand-600">{BUSINESS.phone}</a> — if we can drive to it, we can probably mow it.
          </p>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 bg-slate-50/50 px-5 md:px-10 py-10 pb-32 md:pb-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <div className="space-y-2">
            <h1 className="text-xl font-black tracking-tighter text-brand-700">TERRAZAS</h1>
            <p className="text-xs text-slate-500 font-medium max-w-xs leading-relaxed">{BUSINESS.tagline}.</p>
          </div>
          <div className="space-y-1.5 text-xs font-bold text-slate-600">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Contact</div>
            <a href={BUSINESS.phoneHref} className="block hover:text-brand-700">{BUSINESS.phone}</a>
            <a href={`mailto:${BUSINESS.email}`} className="block hover:text-brand-700">{BUSINESS.email}</a>
            <span className="block text-slate-400">{BUSINESS.city}</span>
          </div>
          <div className="space-y-1.5 text-xs font-bold text-slate-600">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Site</div>
            <a href="/dashboard" className="block hover:text-brand-700">My Jobs</a>
            <a href="/terms" className="block hover:text-brand-700">Terms of Service</a>
            <a href="/privacy" className="block hover:text-brand-700">Privacy Policy</a>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-8 pt-6 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
          &copy; 2026 {BUSINESS.name}. All rights reserved.
        </div>
      </footer>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden p-4 pb-8 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center safe-bottom">
        <span className="w-14 h-14 flex items-center justify-center rounded-4xl bg-brand-50 text-brand-600 text-xl">🏠</span>
        <a href="/dashboard?tab=jobs" className="w-14 h-14 flex items-center justify-center rounded-4xl text-slate-300 hover:text-brand-500 transition-colors text-xl">🗓️</a>
        <a href={BUSINESS.phoneHref} className="w-14 h-14 flex items-center justify-center rounded-4xl text-slate-300 hover:text-brand-500 transition-colors text-xl">📞</a>
        <a href="/dashboard?tab=profile" className="w-14 h-14 flex items-center justify-center rounded-4xl text-slate-300 hover:text-brand-500 transition-colors text-xl">👤</a>
      </nav>

      <AuthModal
        isOpen={authModalConfig.isOpen}
        onClose={() => setAuthModalConfig({ ...authModalConfig, isOpen: false })}
        initialRole={authModalConfig.initialRole}
        initialView={authModalConfig.initialView}
      />
    </div>
  );
}

// ── Zip availability checker ─────────────────────────────────────────
function ZipCard({ zip, setZip, zipResult, checkZip, bookService }: {
  zip: string;
  setZip: (z: string) => void;
  zipResult: 'served' | 'unserved' | null;
  checkZip: () => void;
  bookService: (id: string) => void;
}) {
  return (
    <div className="bg-white border-2 border-slate-100 rounded-5xl p-6 shadow-xl shadow-slate-100 space-y-4">
      <div>
        <h3 className="text-lg font-black tracking-tight">Do we serve your area?</h3>
        <p className="text-[11px] text-slate-500 font-bold mt-0.5">Enter your zip code to check.</p>
      </div>
      <div className="relative">
        <input type="text" maxLength={5} inputMode="numeric" placeholder="Zip Code" value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && checkZip()}
          className="w-full bg-slate-50 border-2 border-slate-100 rounded-4xl p-5 text-xl font-black tracking-[0.2em] placeholder:text-slate-300 focus:bg-white focus:border-brand-500 focus:outline-none transition-all shadow-inner" />
        <button onClick={checkZip} disabled={zip.length < 5}
          className="absolute right-2.5 top-2.5 bottom-2.5 bg-brand-600 text-white px-6 rounded-4xl font-black text-xs shadow-lg shadow-brand-200 active:scale-95 transition-all disabled:bg-slate-300 disabled:shadow-none">
          GO
        </button>
      </div>
      {zipResult === 'served' && (
        <div className="p-4 bg-brand-50 border border-brand-100 rounded-3xl space-y-3 animate-fade-in">
          <div className="text-xs font-black text-brand-800">✅ You&apos;re in our service area!</div>
          <div className="flex gap-2">
            <button onClick={() => bookService('mowing')}
              className="flex-1 bg-brand-600 text-white text-[11px] font-black py-3 rounded-2xl active:scale-95 transition-all">
              Book a Mow
            </button>
            <button onClick={() => bookService('tree_removal')}
              className="flex-1 bg-slate-900 text-white text-[11px] font-black py-3 rounded-2xl active:scale-95 transition-all">
              Get a Quote
            </button>
          </div>
        </div>
      )}
      {zipResult === 'unserved' && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-3xl animate-fade-in">
          <div className="text-xs font-black text-amber-800">We&apos;re not in {zip} regularly yet.</div>
          <p className="text-[11px] text-amber-700 font-bold mt-1">
            Give us a call at <a href={BUSINESS.phoneHref} className="underline">{BUSINESS.phone}</a> — for bigger jobs we&apos;ll travel.
          </p>
        </div>
      )}
    </div>
  );
}

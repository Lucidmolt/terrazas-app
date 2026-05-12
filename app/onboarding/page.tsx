'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { TIERS, SERVICE_TYPES } from '@/lib/constants';

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const role = searchParams.get('role') || 'customer';
  const zip = searchParams.get('zip') || '';

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', businessName: '',
    selectedServices: [] as string[], zipCodes: zip ? [zip] : [],
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    // For local dev, simulate onboarding success
    setTimeout(() => {
      setLoading(false);
      router.push(role === 'pro' ? '/pro' : '/');
    }, 1500);
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleService = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedServices: prev.selectedServices.includes(id)
        ? prev.selectedServices.filter((s) => s !== id)
        : [...prev.selectedServices, id],
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <a href="/"><h1 className="text-4xl font-black tracking-tighter text-brand-700">TERRAZAS</h1></a>
          <p className="text-slate-500 font-medium text-sm">
            {role === 'customer' ? 'Set up your account' : 'Join our Pro network'}
          </p>
        </div>

        {/* Progress */}
        <div className="flex space-x-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i <= step ? 'bg-brand-600' : 'bg-slate-200'}`} />
          ))}
        </div>

        <div className="glass rounded-5xl p-8 shadow-2xl border border-white space-y-6 animate-fade-in">
          {/* Step 0: Personal Info */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-black tracking-tight">{role === 'pro' ? 'Business Info' : 'Your Info'}</h2>
              <div className="space-y-3">
                <input type="text" placeholder="Full Name" value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)} className="input-field" />
                <input type="email" placeholder="Email" value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)} className="input-field" />
                {role === 'pro' && (
                  <>
                    <input type="tel" placeholder="Phone Number" value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)} className="input-field" />
                    <input type="text" placeholder="Business Name" value={formData.businessName}
                      onChange={(e) => updateField('businessName', e.target.value)} className="input-field" />
                  </>
                )}
              </div>
              <button onClick={() => setStep(1)} disabled={!formData.name || !formData.email} className="btn-brand">
                Continue →
              </button>
            </div>
          )}

          {/* Step 1: Services */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black tracking-tight">
                  {role === 'customer' ? 'What do you need?' : 'Services You Offer'}
                </h2>
                <button onClick={() => setStep(0)} className="text-micro text-slate-400 font-bold">← Back</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(SERVICE_TYPES).map(([id, svc]) => (
                  <button key={id} onClick={() => toggleService(id)}
                    className={`p-4 rounded-4xl border-2 transition-all text-left ${
                      formData.selectedServices.includes(id)
                        ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-200'
                        : 'bg-white border-slate-100 hover:border-brand-300'
                    }`}>
                    <div className="text-2xl mb-1">{svc.emoji}</div>
                    <div className={`text-xs font-bold ${formData.selectedServices.includes(id) ? 'text-white' : 'text-slate-800'}`}>{svc.label}</div>
                    <div className={`text-micro mt-1 ${formData.selectedServices.includes(id) ? 'text-white/70' : 'text-slate-400'}`}>From ${svc.startingPrice}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(2)} disabled={formData.selectedServices.length === 0} className="btn-brand">
                Continue →
              </button>
            </div>
          )}

          {/* Step 2: Confirm */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black tracking-tight">Confirm</h2>
                <button onClick={() => setStep(1)} className="text-micro text-slate-400 font-bold">← Back</button>
              </div>
              <div className="bg-slate-50 rounded-4xl p-5 space-y-3">
                <div className="flex justify-between text-sm"><span className="text-slate-400 font-bold">Name</span><span className="font-bold">{formData.name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400 font-bold">Email</span><span className="font-bold">{formData.email}</span></div>
                {role === 'pro' && formData.businessName && <div className="flex justify-between text-sm"><span className="text-slate-400 font-bold">Business</span><span className="font-bold">{formData.businessName}</span></div>}
                <div className="flex justify-between text-sm"><span className="text-slate-400 font-bold">Services</span><span className="font-bold">{formData.selectedServices.length} selected</span></div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-[10px] font-bold text-amber-700 text-center">🔧 Dev Mode: Onboarding is simulated locally.</p>
              </div>

              <button onClick={handleSubmit} disabled={loading} className="btn-brand">
                {loading ? 'Setting up...' : role === 'pro' ? 'Join Terrazas Pro' : 'Complete Setup'}
              </button>
            </div>
          )}
        </div>

        <div className="text-center">
          <a href="/" className="text-micro text-slate-400 hover:text-slate-600 transition-colors">← Back to Home</a>
        </div>
      </div>
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

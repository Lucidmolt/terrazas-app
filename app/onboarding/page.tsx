'use client';
import React, { Suspense, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const role = searchParams.get('role') || 'customer';
  const zip = searchParams.get('zip') || '';

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Google search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [skipGoogle, setSkipGoogle] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', businessName: '', bio: '',
    selectedServices: [] as string[], zipCodes: zip ? [zip] : [],
    logoUrl: '', portfolioPhotos: [] as string[], yearsInBusiness: '',
    teamSize: '', equipmentType: '', googlePlaceId: '',
    website: '', googleRating: 0, googleReviewCount: 0,
  });
  const [tosAccepted, setTosAccepted] = useState(false);

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  // Google business search
  const searchGoogle = useCallback(async () => {
    if (searchQuery.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/business/search?q=${encodeURIComponent(searchQuery)}&zip=${zip || '67901'}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {} finally { setSearching(false); }
  }, [searchQuery, zip]);

  // Select a Google business result
  const selectBusiness = async (placeId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/business/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId }),
      });
      const data = await res.json();
      if (data.prefill) {
        const p = data.prefill;
        setForm(f => ({
          ...f, businessName: p.businessName || f.businessName, phone: p.phone || f.phone,
          bio: p.suggestedBio || f.bio, googlePlaceId: p.googlePlaceId || '',
          zipCodes: p.zipCode ? [p.zipCode] : f.zipCodes, website: p.website || '',
          portfolioPhotos: p.portfolioPhotos || [],
          googleRating: p.rating || 0, googleReviewCount: p.reviewCount || 0,
          logoUrl: data.profile?.photoUrls?.[0] || '',
        }));
        setSearchResults([]);
        setStep(2); // Skip to profile details
      }
    } catch {} finally { setLoading(false); }
  };

  // Upload helper
  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const fd = new FormData(); fd.append('file', file); fd.append('folder', folder);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    return data.url || null;
  };

  // Submit
  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, email: form.email, phone: form.phone, role,
          businessName: form.businessName, selectedServices: form.selectedServices,
          zipCodes: form.zipCodes, bio: form.bio, logoUrl: form.logoUrl,
          portfolioPhotos: form.portfolioPhotos, yearsInBusiness: form.yearsInBusiness ? parseInt(form.yearsInBusiness) : undefined,
          teamSize: form.teamSize, equipmentType: form.equipmentType,
          googlePlaceId: form.googlePlaceId, tosAccepted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return; }
      router.push(`/login?role=${role}&onboarded=true`);
    } catch { setError('Something went wrong'); }
    setLoading(false);
  };

  const services = ['mowing', 'edging', 'hedge_trimming', 'leaf_cleanup', 'full_landscaping', 'fertilizing', 'aeration', 'snow_removal'];
  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 };
  const input: React.CSSProperties = { width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const primaryBtn: React.CSSProperties = { padding: '14px 32px', borderRadius: 12, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', width: '100%' };
  const optBtn = (active: boolean): React.CSSProperties => ({ padding: '10px 16px', borderRadius: 10, border: active ? '2px solid #059669' : '1px solid #d1d5db', background: active ? '#ecfdf5' : '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: active ? '#059669' : '#374151' });

  // Customer onboarding (simple)
  if (role === 'customer') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 50%, #f0fdf4 100%)', fontFamily: "'Inter', sans-serif" }}>
        <header style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.9)' }}>
          <div style={{ maxWidth: 500, margin: '0 auto' }}><h1 style={{ fontSize: 22, fontWeight: 900, color: '#166534' }}>TERRAZAS</h1></div>
        </header>
        <main style={{ maxWidth: 500, margin: '0 auto', padding: '32px 16px' }}>
          <div style={card}>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Create your account</h2>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>Get matched with verified lawn pros in minutes.</p>
            {error && <div style={{ padding: 12, borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Full Name</label>
            <input style={input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Smith" />
            <div style={{ height: 12 }} />
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Email</label>
            <input style={input} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@email.com" />
            <div style={{ height: 12 }} />
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Phone</label>
            <input style={input} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(620) 555-1234" />
            <div style={{ height: 12 }} />
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Zip Code</label>
            <input style={input} maxLength={5} value={form.zipCodes[0] || ''} onChange={e => set('zipCodes', [e.target.value])} placeholder="67901" />
            <div style={{ height: 16 }} />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={tosAccepted} onChange={e => setTosAccepted(e.target.checked)} style={{ marginTop: 3 }} />
              <span style={{ fontSize: 12, color: '#64748b' }}>I agree to the <a href="/terms" target="_blank" style={{ color: '#059669' }}>Terms of Service</a></span>
            </label>
            <div style={{ height: 16 }} />
            <button style={{ ...primaryBtn, opacity: (!form.name || !form.email || !tosAccepted) ? 0.5 : 1 }} disabled={!form.name || !form.email || !tosAccepted || loading} onClick={handleSubmit}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Provider onboarding (multi-step)
  const providerSteps = ['Find Business', 'Your Info', 'Profile', 'Services', 'Review'];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 50%, #f0fdf4 100%)', fontFamily: "'Inter', sans-serif" }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#166534', margin: 0 }}>TERRAZAS</h1>
          <span style={{ fontSize: 13, color: '#64748b' }}>Provider Onboarding</span>
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 80px' }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {providerSteps.map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 4, borderRadius: 2, background: i <= step ? '#059669' : '#e2e8f0', transition: 'all 0.3s' }} />
              <span style={{ fontSize: 10, color: i <= step ? '#059669' : '#94a3b8', fontWeight: 600 }}>{s}</span>
            </div>
          ))}
        </div>

        {error && <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b', fontSize: 13 }}>{error}</div>}

        {/* Step 0: Google Business Search */}
        {step === 0 && (
          <div style={card}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>🔍 Find your business on Google</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>We&apos;ll auto-fill your profile from your Google Business listing. Saves you a ton of typing!</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...input, flex: 1 }} placeholder="e.g. GAS Lawn Pros" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchGoogle()} />
              <button onClick={searchGoogle} disabled={searching} style={{ padding: '12px 20px', borderRadius: 10, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {searching ? '...' : 'Search'}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {searchResults.map((r: any) => (
                  <button key={r.placeId} onClick={() => selectBusiness(r.placeId)} style={{ display: 'block', width: '100%', padding: '12px', marginBottom: 8, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{r.address}</div>
                    {r.rating > 0 && <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>{'★'.repeat(Math.round(r.rating))} {r.rating} ({r.reviewCount} reviews)</div>}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { setSkipGoogle(true); setStep(1); }} style={{ marginTop: 16, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
              Skip — I&apos;ll fill in manually
            </button>
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div style={card}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>👤 Your Information</h2>
            {[
              { key: 'name', label: 'Your Full Name', placeholder: 'Jose Martinez' },
              { key: 'email', label: 'Business Email', placeholder: 'jose@gaslawnpros.com', type: 'email' },
              { key: 'phone', label: 'Business Phone', placeholder: '(620) 555-1234', type: 'tel' },
              { key: 'businessName', label: 'Business Name', placeholder: 'GAS Lawn Pros LLC' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input style={input} type={(f as any).type || 'text'} placeholder={f.placeholder} value={(form as any)[f.key]} onChange={e => set(f.key, e.target.value)} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button style={{ ...primaryBtn, background: '#f1f5f9', color: '#475569' }} onClick={() => setStep(0)}>← Back</button>
              <button style={primaryBtn} disabled={!form.name || !form.email || !form.businessName} onClick={() => setStep(2)}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 2: Profile */}
        {step === 2 && (
          <>
            <div style={card}>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>🏢 Business Profile</h2>
              {form.googleRating > 0 && (
                <div style={{ padding: 12, borderRadius: 10, background: '#f0fdf4', marginBottom: 16, fontSize: 13, color: '#059669' }}>
                  ✅ Imported from Google: {form.googleRating}★ ({form.googleReviewCount} reviews)
                </div>
              )}
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>About Your Business (min 50 chars)</label>
              <textarea style={{ ...input, minHeight: 100, resize: 'vertical' }} placeholder="Tell customers about your business..." value={form.bio} onChange={e => set('bio', e.target.value)} />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{form.bio.length}/50 characters minimum</div>
              <div style={{ height: 12 }} />
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Logo</label>
              {form.logoUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={form.logoUrl} alt="Logo" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
                  <button onClick={() => set('logoUrl', '')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13 }}>Remove</button>
                </div>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, borderRadius: 12, border: '2px dashed #d1d5db', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>
                  📷 Upload logo
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => { if (e.target.files?.[0]) { const url = await uploadFile(e.target.files[0], 'logos'); if (url) set('logoUrl', url); } }} />
                </label>
              )}
              <div style={{ height: 12 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Years in Business</label>
                  <input style={input} type="number" value={form.yearsInBusiness} onChange={e => set('yearsInBusiness', e.target.value)} placeholder="5" />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Team Size</label>
                  <select style={input} value={form.teamSize} onChange={e => set('teamSize', e.target.value)}>
                    <option value="">Select...</option>
                    <option value="solo">Solo</option>
                    <option value="small">2-4 people</option>
                    <option value="medium">5+ people</option>
                  </select>
                </div>
              </div>
            </div>
            {/* Portfolio */}
            {form.portfolioPhotos.length > 0 && (
              <div style={card}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📸 Portfolio ({form.portfolioPhotos.length} photos)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {form.portfolioPhotos.slice(0, 6).map((url, i) => (
                    <img key={i} src={url} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ ...primaryBtn, background: '#f1f5f9', color: '#475569' }} onClick={() => setStep(skipGoogle ? 1 : 0)}>← Back</button>
              <button style={primaryBtn} disabled={form.bio.length < 50} onClick={() => setStep(3)}>Continue →</button>
            </div>
          </>
        )}

        {/* Step 3: Services */}
        {step === 3 && (
          <div style={card}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>🔧 Services You Offer</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Select all that apply. You&apos;ll only receive jobs matching these.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {services.map(s => (
                <button key={s} style={optBtn(form.selectedServices.includes(s))} onClick={() => set('selectedServices', form.selectedServices.includes(s) ? form.selectedServices.filter(x => x !== s) : [...form.selectedServices, s])}>
                  {form.selectedServices.includes(s) ? '✅ ' : ''}{s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <div style={{ height: 16 }} />
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Service Zip Codes (comma-separated)</label>
            <input style={input} value={form.zipCodes.join(', ')} onChange={e => set('zipCodes', e.target.value.split(',').map(z => z.trim()).filter(Boolean))} placeholder="67901, 67905" />
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button style={{ ...primaryBtn, background: '#f1f5f9', color: '#475569' }} onClick={() => setStep(2)}>← Back</button>
              <button style={primaryBtn} disabled={form.selectedServices.length === 0} onClick={() => setStep(4)}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 4: Review & TOS */}
        {step === 4 && (
          <>
            <div style={card}>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>📋 Review Your Profile</h2>
              <div style={{ fontSize: 14, lineHeight: 1.8, color: '#475569' }}>
                <div><strong>Business:</strong> {form.businessName}</div>
                <div><strong>Contact:</strong> {form.name} · {form.email} · {form.phone}</div>
                <div><strong>Services:</strong> {form.selectedServices.join(', ')}</div>
                <div><strong>Zip codes:</strong> {form.zipCodes.join(', ')}</div>
                <div><strong>Team:</strong> {form.teamSize || 'Not specified'} · {form.yearsInBusiness ? `${form.yearsInBusiness} years` : 'N/A'}</div>
                {form.googlePlaceId && <div><strong>Google Business:</strong> ✅ Linked</div>}
              </div>
            </div>
            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📜 Terms of Service</h3>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, maxHeight: 200, overflowY: 'auto', padding: 12, background: '#f8fafc', borderRadius: 8, marginBottom: 12 }}>
                By joining Terrazas as a service provider, you agree that: (1) Terrazas acts solely as a marketplace platform connecting customers and independent service providers. (2) You are an independent contractor, not an employee of Terrazas. (3) You are responsible for your own insurance, licensing, and tax obligations. (4) Terrazas charges a 13% service fee on each completed job. (5) Customer vetos are anonymous and final. (6) Terrazas assumes no liability for work performed. See full terms at terrazas.app/terms.
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={tosAccepted} onChange={e => setTosAccepted(e.target.checked)} style={{ marginTop: 3 }} />
                <span style={{ fontSize: 13, color: '#374151' }}>I agree to the <a href="/terms" target="_blank" style={{ color: '#059669' }}>Terms of Service</a> and understand the provider agreement.</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ ...primaryBtn, background: '#f1f5f9', color: '#475569' }} onClick={() => setStep(3)}>← Back</button>
              <button style={{ ...primaryBtn, opacity: (!tosAccepted || loading) ? 0.5 : 1 }} disabled={!tosAccepted || loading} onClick={handleSubmit}>
                {loading ? 'Submitting...' : '🚀 Submit Application'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>}><OnboardingContent /></Suspense>;
}

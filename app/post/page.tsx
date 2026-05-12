'use client';
import React, { useState, useCallback } from 'react';

const SCOPE_OPTIONS = [
  { value: 'front_only', label: 'Front yard only', mult: '0.6x', icon: '🏠' },
  { value: 'back_only', label: 'Back yard only', mult: '0.7x', icon: '🌿' },
  { value: 'front_back', label: 'Front + Back', mult: '1.0x', icon: '🏡' },
  { value: 'full_property', label: 'Full property', mult: '1.2x', icon: '🌳' },
];
const LOT_OPTIONS = [
  { value: 'small', label: 'Small (< 0.15 acre)', mult: '0.8x' },
  { value: 'medium', label: 'Medium (0.15–0.3 acre)', mult: '1.0x' },
  { value: 'large', label: 'Large (0.3–0.5 acre)', mult: '1.3x' },
  { value: 'xl', label: 'XL (> 0.5 acre)', mult: '1.6x' },
];
const URGENCY_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled (2+ days)', mult: '0.9x', icon: '📅' },
  { value: 'same_day', label: 'Same day', mult: '1.0x', icon: '☀️' },
  { value: 'asap', label: 'ASAP (within 2 hours)', mult: '1.2x', icon: '⚡' },
];
const EXTRAS = [
  { key: 'edging', label: 'Edging', cost: 10 },
  { key: 'bag_clippings', label: 'Bag clippings', cost: 10 },
  { key: 'dog_waste', label: 'Dog waste cleanup', cost: 15 },
  { key: 'hedge_trim', label: 'Hedge trimming', cost: 20 },
  { key: 'steep_slope', label: 'Steep slope surcharge', cost: 10 },
  { key: 'heavy_debris', label: 'Heavy debris/leaves', cost: 15 },
];

export default function PostJobPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pricing, setPricing] = useState<any>(null);
  const [photos, setPhotos] = useState<{ front?: string; back?: string; extra?: string }>({});
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    address: '', zipCode: '', scope: 'front_back', lotSize: 'medium',
    urgency: 'same_day', tier: 'basic', extras: [] as string[], customerNotes: '',
  });

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));
  const toggleExtra = (key: string) => set('extras', form.extras.includes(key) ? form.extras.filter(e => e !== key) : [...form.extras, key]);

  // Upload a photo
  const uploadPhoto = useCallback(async (file: File, slot: 'front' | 'back' | 'extra') => {
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'yards');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) setPhotos(p => ({ ...p, [slot]: data.url }));
      else setError('Photo upload failed');
    } catch { setError('Photo upload failed'); }
    setUploading(false);
  }, []);

  // Fetch price preview
  const fetchPreview = useCallback(async () => {
    const params = new URLSearchParams({
      scope: form.scope, lotSize: form.lotSize, urgency: form.urgency,
      tier: form.tier, conditionScore: '5', ...(form.extras.length ? { extras: form.extras.join(',') } : {}),
    });
    const res = await fetch(`/api/pricing?${params}`);
    const data = await res.json();
    setPricing(data);
  }, [form]);

  // Submit job
  const submitJob = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: form.address, zipCode: form.zipCode, scope: form.scope,
          lotSize: form.lotSize, urgency: form.urgency, tier: form.tier,
          extras: form.extras, customerNotes: form.customerNotes,
          photoFrontUrl: photos.front, photoBackUrl: photos.back, photoExtraUrl: photos.extra,
          conditionScore: 5,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      // Redirect to checkout or dashboard
      window.location.href = `/dashboard?newJob=${data.job?.id || ''}`;
    } catch { setError('Failed to create job'); }
    setLoading(false);
  };

  const steps = ['Location', 'Yard Details', 'Photos', 'Review & Pay'];

  const s: React.CSSProperties = {
    minHeight: '100vh', background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 50%, #f0fdf4 100%)',
    fontFamily: "'Inter', -apple-system, sans-serif",
  };
  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 16, padding: '28px 24px', border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16,
  };
  const btn = (active?: boolean): React.CSSProperties => ({
    padding: '12px 24px', borderRadius: 12, border: active ? '2px solid #059669' : '1px solid #d1d5db',
    background: active ? '#ecfdf5' : '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14,
    color: active ? '#059669' : '#374151', transition: 'all 0.15s',
  });
  const primaryBtn: React.CSSProperties = {
    padding: '14px 32px', borderRadius: 12, border: 'none', background: '#059669',
    color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', width: '100%',
  };
  const input: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #d1d5db',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={s}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none' }}><h1 style={{ fontSize: 22, fontWeight: 900, color: '#166534', margin: 0 }}>TERRAZAS</h1></a>
          <span style={{ fontSize: 14, color: '#64748b' }}>Post a Job</span>
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 80px' }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {steps.map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 4, borderRadius: 2, background: i <= step ? '#059669' : '#e2e8f0', marginBottom: 6, transition: 'background 0.3s' }} />
              <span style={{ fontSize: 11, color: i <= step ? '#059669' : '#94a3b8', fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>

        {error && <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b', fontSize: 14 }}>{error}</div>}

        {/* STEP 0: Location */}
        {step === 0 && (
          <div style={card}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>📍 Where&apos;s the job?</h2>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>Street Address</label>
            <input style={input} placeholder="412 N Kansas Ave" value={form.address} onChange={e => set('address', e.target.value)} />
            <div style={{ height: 12 }} />
            <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>Zip Code</label>
            <input style={input} placeholder="67901" maxLength={5} value={form.zipCode} onChange={e => set('zipCode', e.target.value)} />
            <div style={{ height: 20 }} />
            <button style={primaryBtn} disabled={!form.address || !form.zipCode} onClick={() => setStep(1)}>Continue →</button>
          </div>
        )}

        {/* STEP 1: Yard Details */}
        {step === 1 && (
          <>
            <div style={card}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>🌿 What needs mowing?</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {SCOPE_OPTIONS.map(o => (
                  <button key={o.value} style={btn(form.scope === o.value)} onClick={() => set('scope', o.value)}>
                    <div style={{ fontSize: 20 }}>{o.icon}</div>
                    <div style={{ fontSize: 13 }}>{o.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📐 Lot size</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {LOT_OPTIONS.map(o => (
                  <button key={o.value} style={{ ...btn(form.lotSize === o.value), textAlign: 'left', display: 'flex', justifyContent: 'space-between' }} onClick={() => set('lotSize', o.value)}>
                    <span>{o.label}</span><span style={{ color: '#94a3b8', fontSize: 12 }}>{o.mult}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>⏱️ How soon?</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {URGENCY_OPTIONS.map(o => (
                  <button key={o.value} style={btn(form.urgency === o.value)} onClick={() => set('urgency', o.value)}>
                    {o.icon} {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>➕ Extras</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {EXTRAS.map(e => (
                  <button key={e.key} style={{ ...btn(form.extras.includes(e.key)), display: 'flex', justifyContent: 'space-between' }} onClick={() => toggleExtra(e.key)}>
                    <span>{form.extras.includes(e.key) ? '✅ ' : ''}{e.label}</span><span style={{ color: '#059669', fontWeight: 700 }}>+${e.cost}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ ...primaryBtn, background: '#f1f5f9', color: '#475569' }} onClick={() => setStep(0)}>← Back</button>
              <button style={primaryBtn} onClick={() => { fetchPreview(); setStep(2); }}>Continue →</button>
            </div>
          </>
        )}

        {/* STEP 2: Photos */}
        {step === 2 && (
          <div style={card}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>📸 Yard Photos</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Upload at least 2 photos so we can assess your yard&apos;s condition and give you an accurate price.</p>
            {(['front', 'back', 'extra'] as const).map(slot => (
              <div key={slot} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>
                  {slot === 'front' ? '🏠 Front yard (required)' : slot === 'back' ? '🌿 Back yard (required)' : '📷 Additional photo (optional)'}
                </label>
                {photos[slot] ? (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '2px solid #059669' }}>
                    <img src={photos[slot]} alt={slot} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                    <button onClick={() => setPhotos(p => ({ ...p, [slot]: undefined }))} style={{ position: 'absolute', top: 8, right: 8, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 20, width: 28, height: 28, cursor: 'pointer', fontWeight: 700 }}>×</button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, borderRadius: 12, border: '2px dashed #d1d5db', cursor: 'pointer', color: '#94a3b8', fontSize: 14, background: '#f8fafc' }}>
                    {uploading ? 'Uploading...' : '📷 Tap to upload'}
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadPhoto(e.target.files[0], slot); }} />
                  </label>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button style={{ ...primaryBtn, background: '#f1f5f9', color: '#475569' }} onClick={() => setStep(1)}>← Back</button>
              <button style={primaryBtn} disabled={!photos.front || !photos.back} onClick={() => { fetchPreview(); setStep(3); }}>
                {!photos.front || !photos.back ? 'Upload 2 photos to continue' : 'Review & Pay →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Review & Pay */}
        {step === 3 && (
          <>
            <div style={card}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>💰 Price Breakdown</h2>
              {pricing ? (
                <div style={{ fontSize: 14, color: '#475569' }}>
                  {[
                    ['Base price', `$${pricing.basePrice}`],
                    ['Scope', `${pricing.scopeLabel} (${pricing.scopeMultiplier}x)`],
                    ['Lot size', `${pricing.lotSizeLabel} (${pricing.lotSizeMultiplier}x)`],
                    ['Condition', `${pricing.conditionLabel} (${pricing.conditionMultiplier}x)`],
                    ['Urgency', `${pricing.urgencyLabel} (${pricing.urgencyMultiplier}x)`],
                  ].map(([label, val]) => (
                    <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span>{label}</span><span style={{ fontWeight: 600 }}>{val}</span>
                    </div>
                  ))}
                  {pricing.extrasBreakdown?.map((e: any) => (
                    <div key={e.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span>+ {e.label}</span><span style={{ fontWeight: 600, color: '#059669' }}>+${e.cost}</span>
                    </div>
                  ))}
                  <div style={{ height: 12 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}><span>Job price</span><span style={{ fontWeight: 700 }}>${pricing.jobPrice}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#94a3b8' }}><span>Service fee (13%)</span><span>${pricing.serviceFee}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#94a3b8' }}><span>Processing fee</span><span>${pricing.processingFee}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid #059669', marginTop: 8, fontSize: 18, fontWeight: 800, color: '#059669' }}>
                    <span>Your total</span><span>${pricing.customerTotal}</span>
                  </div>
                </div>
              ) : <p style={{ color: '#94a3b8' }}>Loading price...</p>}
            </div>
            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📝 Special instructions (optional)</h3>
              <textarea style={{ ...input, minHeight: 80, resize: 'vertical' }} placeholder="Gate code, pet info, anything the provider should know..." value={form.customerNotes} onChange={e => set('customerNotes', e.target.value)} />
            </div>
            <div style={card}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📋 Summary</h3>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                <div>📍 {form.address}, {form.zipCode}</div>
                <div>🌿 {SCOPE_OPTIONS.find(o => o.value === form.scope)?.label} • {LOT_OPTIONS.find(o => o.value === form.lotSize)?.label}</div>
                <div>⏱️ {URGENCY_OPTIONS.find(o => o.value === form.urgency)?.label}</div>
                {form.extras.length > 0 && <div>➕ {form.extras.map(e => EXTRAS.find(x => x.key === e)?.label).join(', ')}</div>}
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 12 }}>
              By posting, you agree to our <a href="/terms" style={{ color: '#059669' }}>Terms of Service</a>
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ ...primaryBtn, background: '#f1f5f9', color: '#475569' }} onClick={() => setStep(2)}>← Back</button>
              <button style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }} disabled={loading} onClick={submitJob}>
                {loading ? 'Posting...' : `Post Job — $${pricing?.customerTotal || '...'}`}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

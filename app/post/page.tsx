'use client';
import React, { useState, useCallback, useEffect } from 'react';

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

  // Address Autocomplete states
  const [addressInput, setAddressInput] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [fetchingSuggestions, setFetchingSuggestions] = useState(false);

  // Scan states
  const [scanScore, setScanScore] = useState<number | null>(null);

  const [form, setForm] = useState({
    address: '',
    zipCode: '',
    latitude: null as number | null,
    longitude: null as number | null,
    placeId: '',
    scope: 'front_back',
    lotSize: 'medium',
    urgency: 'same_day',
    tier: 'basic',
    extras: [] as string[],
    customerNotes: '',
    conditionScore: 5,
  });

  // Check for scan query parameter or local storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const scan = params.get('scan');
      let score: number | null = null;
      if (scan) {
        score = parseFloat(scan);
        localStorage.setItem('terrazas_scan_score', scan);
      } else {
        const stored = localStorage.getItem('terrazas_scan_score');
        if (stored) {
          score = parseFloat(stored);
        }
      }
      if (score !== null) {
        setScanScore(score);
        setForm(f => ({ ...f, conditionScore: score! }));
      }
    }
  }, []);

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));
  const toggleExtra = (key: string) => set('extras', form.extras.includes(key) ? form.extras.filter(e => e !== key) : [...form.extras, key]);

  // Real-time Pricing synchronization
  useEffect(() => {
    const fetchRealTimePreview = async () => {
      const params = new URLSearchParams({
        scope: form.scope,
        lotSize: form.lotSize,
        urgency: form.urgency,
        tier: form.tier,
        conditionScore: form.conditionScore.toString(),
        ...(form.extras.length ? { extras: form.extras.join(',') } : {}),
      });
      try {
        const res = await fetch(`/api/pricing?${params}`);
        if (res.ok) {
          const data = await res.json();
          setPricing(data);
        }
      } catch (err) {
        console.error('Failed to fetch pricing preview:', err);
      }
    };
    fetchRealTimePreview();
  }, [form.scope, form.lotSize, form.urgency, form.tier, form.conditionScore, form.extras]);

  // Handle address input typing
  const handleAddressChange = async (val: string) => {
    setAddressInput(val);
    set('address', val);
    if (val.length > 2) {
      setFetchingSuggestions(true);
      try {
        const res = await fetch(`/api/maps/geocode?q=${encodeURIComponent(val)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.results || []);
        }
      } catch (err) {
        console.error('Autocomplete suggestions error:', err);
      } finally {
        setFetchingSuggestions(false);
      }
    } else {
      setSuggestions([]);
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = async (sugg: any) => {
    setSuggestions([]);
    setAddressInput(sugg.description);
    set('address', sugg.description);
    setLoading(true);
    try {
      const res = await fetch(`/api/maps/geocode?placeId=${sugg.placeId}`);
      if (res.ok) {
        const result = await res.json();
        setForm(f => ({
          ...f,
          address: result.address || sugg.description,
          zipCode: result.zipCode || f.zipCode,
          latitude: result.lat,
          longitude: result.lng,
          placeId: result.placeId,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch place details:', err);
    } finally {
      setLoading(false);
    }
  };

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

  // Submit job
  const submitJob = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: form.address,
          zipCode: form.zipCode,
          scope: form.scope,
          lotSize: form.lotSize,
          urgency: form.urgency,
          tier: form.tier,
          extras: form.extras,
          customerNotes: form.customerNotes,
          photoFrontUrl: photos.front,
          photoBackUrl: photos.back,
          photoExtraUrl: photos.extra,
          conditionScore: form.conditionScore,
          latitude: form.latitude,
          longitude: form.longitude,
          placeId: form.placeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      // Redirect to dashboard
      window.location.href = `/dashboard?newJob=${data.job?.id || ''}`;
    } catch { setError('Failed to create job'); }
    setLoading(false);
  };

  const steps = ['Location', 'Yard Details', 'Photos', 'Review & Pay'];

  const getConditionLabel = (score: number) => {
    if (score <= 3) return { label: 'Well-Kept', color: '#059669', bg: '#ecfdf5', icon: '✨' };
    if (score <= 6) return { label: 'Average', color: '#475569', bg: '#f1f5f9', icon: '🏡' };
    if (score <= 8) return { label: 'Overgrown Surcharge', color: '#d97706', bg: '#fffbeb', icon: '⚠️' };
    return { label: 'Neglected Surcharge', color: '#dc2626', bg: '#fef2f2', icon: '🚨' };
  };

  const s: React.CSSProperties = {
    minHeight: '100vh', background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 50%, #f0fdf4 100%)',
    fontFamily: "'Inter', -apple-system, sans-serif",
  };
  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 24, padding: '32px 28px', border: '1px solid #e2e8f0',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.02), 0 8px 10px -6px rgba(0,0,0,0.02)', marginBottom: 20,
    animation: 'fadeIn 0.4s ease-out',
  };
  const primaryBtn: React.CSSProperties = {
    padding: '14px 32px', borderRadius: 14, border: 'none', background: '#059669',
    color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', width: '100%',
    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.2)', transition: 'all 0.2s',
  };
  const input: React.CSSProperties = {
    width: '100%', padding: '14px 18px', borderRadius: 12, border: '1px solid #cbd5e1',
    fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#f8fafc',
    transition: 'all 0.2s',
  };

  return (
    <div style={s}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { transform: translate(-50%, 100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
      
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none' }}><h1 style={{ fontSize: 22, fontWeight: 900, color: '#166534', margin: 0 }}>TERRAZAS</h1></a>
          <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>Post a Job</span>
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 140px' }}>
        
        {/* Visual Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, position: 'relative' }}>
          <div style={{ position: 'absolute', top: '18px', left: '20px', right: '20px', height: '2px', background: '#e2e8f0', zIndex: 1 }} />
          <div style={{ position: 'absolute', top: '18px', left: '20px', right: '20px', height: '2px', background: '#059669', width: `${(step / (steps.length - 1)) * 100}%`, zIndex: 1, transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />

          {steps.map((label, i) => {
            const isCompleted = i < step;
            const isActive = i === step;
            return (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, flex: 1 }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: isCompleted ? '#059669' : isActive ? '#ecfdf5' : '#fff',
                  border: `2px solid ${isCompleted || isActive ? '#059669' : '#cbd5e1'}`,
                  color: isCompleted ? '#fff' : isActive ? '#059669' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 800,
                  boxShadow: isActive ? '0 0 10px rgba(5, 150, 105, 0.2)' : 'none',
                  transition: 'all 0.3s ease',
                }}>
                  {isCompleted ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: '10px',
                  color: isActive ? '#0f172a' : isCompleted ? '#059669' : '#94a3b8',
                  fontWeight: isActive || isCompleted ? 700 : 500,
                  marginTop: '8px',
                  textAlign: 'center',
                }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Condition Scan Banner */}
        {scanScore !== null && (
          <div style={{
            background: getConditionLabel(scanScore).bg,
            border: '1px solid',
            borderColor: getConditionLabel(scanScore).color,
            borderRadius: '18px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)',
            animation: 'fadeIn 0.3s ease-out',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>{getConditionLabel(scanScore).icon}</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: getConditionLabel(scanScore).color }}>
                  AI YARD VISION SCAN APPLIED
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  Yard Condition: <strong style={{ color: getConditionLabel(scanScore).color }}>{getConditionLabel(scanScore).label}</strong> (Score: {scanScore}/10)
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setScanScore(null);
                localStorage.removeItem('terrazas_scan_score');
                setForm(f => ({ ...f, conditionScore: 5 }));
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              Clear
            </button>
          </div>
        )}

        {error && <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b', fontSize: 14, fontWeight: 600 }}>⚠️ {error}</div>}

        {/* STEP 0: Location */}
        {step === 0 && (
          <div style={card}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 18 }}>📍 Where&apos;s the job?</h2>
            
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Street Address</label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input
                style={input}
                placeholder="Type your address..."
                value={addressInput}
                onChange={e => handleAddressChange(e.target.value)}
                autoComplete="street-address"
              />
              
              {fetchingSuggestions && (
                <div style={{ position: 'absolute', right: 14, top: 14, fontSize: 12, color: '#94a3b8' }}>Searching...</div>
              )}

              {suggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                  zIndex: 50,
                  marginTop: '4px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}>
                  {suggestions.map((sugg) => (
                    <div
                      key={sugg.placeId}
                      onClick={() => handleSelectSuggestion(sugg)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                    >
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>📍 {sugg.mainText}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{sugg.secondaryText}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zip Code</label>
            <input
              style={input}
              placeholder="e.g. 67901"
              maxLength={5}
              value={form.zipCode}
              onChange={e => set('zipCode', e.target.value)}
              autoComplete="postal-code"
            />
            
            <div style={{ height: 24 }} />
            
            <button
              style={{ ...primaryBtn, opacity: !form.address || !form.zipCode || loading ? 0.6 : 1 }}
              disabled={!form.address || !form.zipCode || loading}
              onClick={() => setStep(1)}
            >
              {loading ? 'Verifying Address...' : 'Continue →'}
            </button>
          </div>
        )}

        {/* STEP 1: Yard Details */}
        {step === 1 && (
          <>
            <div style={card}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 18 }}>🌿 What needs mowing?</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {SCOPE_OPTIONS.map(o => {
                  const active = form.scope === o.value;
                  return (
                    <button
                      key={o.value}
                      style={{
                        padding: '20px 16px',
                        borderRadius: '16px',
                        border: active ? '2px solid #059669' : '1px solid #cbd5e1',
                        background: active ? '#ecfdf5' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s',
                        boxShadow: active ? '0 4px 12px rgba(5, 150, 105, 0.08)' : 'none',
                      }}
                      onClick={() => set('scope', o.value)}
                    >
                      <div style={{ fontSize: '32px' }}>{o.icon}</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: active ? '#059669' : '#1e293b' }}>{o.label}</div>
                      <div style={{ fontSize: '11px', color: active ? '#059669' : '#94a3b8', fontWeight: 700 }}>{o.mult} multiplier</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={card}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>📐 Lot size</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {LOT_OPTIONS.map(o => {
                  const active = form.lotSize === o.value;
                  return (
                    <button
                      key={o.value}
                      style={{
                        padding: '16px 20px',
                        borderRadius: '14px',
                        border: active ? '2px solid #059669' : '1px solid #cbd5e1',
                        background: active ? '#ecfdf5' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s',
                        boxShadow: active ? '0 4px 10px rgba(5, 150, 105, 0.04)' : 'none',
                      }}
                      onClick={() => set('lotSize', o.value)}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 700, color: active ? '#059669' : '#1e293b' }}>{o.label}</span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: active ? '#059669' : '#64748b',
                        background: active ? 'rgba(5, 150, 105, 0.1)' : '#f1f5f9',
                        padding: '4px 10px',
                        borderRadius: '8px',
                      }}>
                        {o.mult} multiplier
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={card}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>⏱️ How soon?</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {URGENCY_OPTIONS.map(o => {
                  const active = form.urgency === o.value;
                  return (
                    <button
                      key={o.value}
                      style={{
                        padding: '16px 12px',
                        borderRadius: '14px',
                        border: active ? '2px solid #059669' : '1px solid #cbd5e1',
                        background: active ? '#ecfdf5' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s',
                        boxShadow: active ? '0 4px 10px rgba(5, 150, 105, 0.04)' : 'none',
                      }}
                      onClick={() => set('urgency', o.value)}
                    >
                      <span style={{ fontSize: '20px' }}>{o.icon}</span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: active ? '#059669' : '#1e293b' }}>{o.label}</span>
                      <span style={{ fontSize: '10px', color: active ? '#059669' : '#94a3b8', fontWeight: 600 }}>{o.mult} multiplier</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={card}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>➕ Add-on Extras</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {EXTRAS.map(e => {
                  const active = form.extras.includes(e.key);
                  return (
                    <button
                      key={e.key}
                      style={{
                        padding: '16px 20px',
                        borderRadius: '14px',
                        border: active ? '2px solid #059669' : '1px solid #cbd5e1',
                        background: active ? '#ecfdf5' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s',
                        boxShadow: active ? '0 4px 10px rgba(5, 150, 105, 0.04)' : 'none',
                      }}
                      onClick={() => toggleExtra(e.key)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '6px',
                          border: `2px solid ${active ? '#059669' : '#cbd5e1'}`,
                          background: active ? '#059669' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 900,
                        }}>
                          {active ? '✓' : ''}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: active ? '#059669' : '#1e293b' }}>{e.label}</span>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>+${e.cost}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button style={{ ...primaryBtn, background: '#f1f5f9', color: '#475569', boxShadow: 'none' }} onClick={() => setStep(0)}>← Back</button>
            </div>
          </>
        )}

        {/* STEP 2: Photos */}
        {step === 2 && (
          <div style={card}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>📸 Yard Photos</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.5 }}>Upload at least 2 photos so we can verify the yard&apos;s condition and provide a final guaranteed price.</p>
            
            {(['front', 'back', 'extra'] as const).map(slot => {
              const uploaded = !!photos[slot];
              return (
                <div key={slot} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {slot === 'front' ? '🏠 Front yard' : slot === 'back' ? '🌿 Back yard' : '📷 Additional photo'}
                      {slot !== 'extra' && <span style={{ color: '#ef4444' }}> *</span>}
                    </label>
                    {uploaded && <span style={{ fontSize: 11, fontWeight: 800, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '20px' }}>✓ Uploaded</span>}
                  </div>
                  {photos[slot] ? (
                    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '2px solid #059669', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                      <img src={photos[slot]} alt={slot} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
                      <button
                        onClick={() => setPhotos(p => ({ ...p, [slot]: undefined }))}
                        style={{
                          position: 'absolute', top: 12, right: 12, background: 'rgba(239, 68, 68, 0.9)',
                          color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32,
                          cursor: 'pointer', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      height: 130, borderRadius: 16, border: '2px dashed #cbd5e1', cursor: 'pointer',
                      color: '#94a3b8', fontSize: 13, background: '#f8fafc', transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#059669')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
                    >
                      <span style={{ fontSize: '28px', marginBottom: '4px' }}>📷</span>
                      <span style={{ fontWeight: 700 }}>{uploading ? 'Uploading...' : 'Tap to upload'}</span>
                      <span style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>JPEG, PNG up to 10MB</span>
                      <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadPhoto(e.target.files[0], slot); }} />
                    </label>
                  )}
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button style={{ ...primaryBtn, background: '#f1f5f9', color: '#475569', boxShadow: 'none' }} onClick={() => setStep(1)}>← Back</button>
            </div>
          </div>
        )}

        {/* STEP 3: Review & Pay */}
        {step === 3 && (
          <>
            <div style={card}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 18 }}>💰 Pricing Receipt</h2>
              {pricing ? (
                <div>
                  <div style={{ background: '#f8fafc', borderRadius: 16, padding: '20px', border: '1px solid #f1f5f9', marginBottom: 16 }}>
                    {[
                      ['Base service price', `$${pricing.basePrice.toFixed(2)}`],
                      ['Scope multiplier', `${pricing.scopeLabel} (${pricing.scopeMultiplier}x)`],
                      ['Lot size multiplier', `${pricing.lotSizeLabel} (${pricing.lotSizeMultiplier}x)`],
                      ['Condition multiplier', `${pricing.conditionLabel} (${pricing.conditionMultiplier}x)`],
                      ['Urgency multiplier', `${pricing.urgencyLabel} (${pricing.urgencyMultiplier}x)`],
                    ].map(([label, val]) => (
                      <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px', color: '#64748b' }}>
                        <span>{label}</span><span style={{ fontWeight: 700, color: '#334155' }}>{val}</span>
                      </div>
                    ))}
                    
                    {pricing.extrasBreakdown?.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #cbd5e1' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Add-on Extras</div>
                        {pricing.extrasBreakdown.map((e: any) => (
                          <div key={e.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', color: '#64748b' }}>
                            <span>+ {e.label}</span><span style={{ fontWeight: 700, color: '#059669' }}>+${e.cost.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px', color: '#475569' }}>
                    <span>Subtotal Job Price</span><span style={{ fontWeight: 700 }}>${pricing.jobPrice.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#94a3b8' }}>
                    <span>Service Fee (13%)</span><span>${pricing.serviceFee.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#94a3b8' }}>
                    <span>Secure processing fee</span><span>${pricing.processingFee.toFixed(2)}</span>
                  </div>
                  
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', padding: '16px 20px', background: '#ecfdf5',
                    borderRadius: '16px', border: '1px solid #d1fae5', marginTop: 16, fontSize: '18px',
                    fontWeight: 900, color: '#059669'
                  }}>
                    <span>Total Charged</span><span>${pricing.customerTotal.toFixed(2)}</span>
                  </div>
                </div>
              ) : <p style={{ color: '#94a3b8' }}>Recalculating price breakdown...</p>}
            </div>

            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>📝 Special instructions</h3>
              <textarea
                style={{ ...input, minHeight: 90, resize: 'vertical' }}
                placeholder="Pet info, gate code, key box location, or details for the provider..."
                value={form.customerNotes}
                onChange={e => set('customerNotes', e.target.value)}
              />
            </div>

            <div style={card}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>📋 Summary Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#475569' }}>
                <div style={{ display: 'flex', gap: '8px' }}><span>📍</span> <strong>{form.address}, {form.zipCode}</strong></div>
                <div style={{ display: 'flex', gap: '8px' }}><span>🌿</span> <span>{SCOPE_OPTIONS.find(o => o.value === form.scope)?.label} ({LOT_OPTIONS.find(o => o.value === form.lotSize)?.label})</span></div>
                <div style={{ display: 'flex', gap: '8px' }}><span>⏱️</span> <span>{URGENCY_OPTIONS.find(o => o.value === form.urgency)?.label}</span></div>
                {form.extras.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span>➕</span>
                    <span>{form.extras.map(e => EXTRAS.find(x => x.key === e)?.label).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

            <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 16 }}>
              By posting, you agree to our <a href="/terms" style={{ color: '#059669', fontWeight: 600, textDecoration: 'none' }}>Terms of Service</a>
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ ...primaryBtn, background: '#f1f5f9', color: '#475569', boxShadow: 'none' }} onClick={() => setStep(2)}>← Back</button>
              <button style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }} disabled={loading} onClick={submitJob}>
                {loading ? 'Confirming escrows...' : `Confirm & Post Job`}
              </button>
            </div>
          </>
        )}

      </main>

      {/* Dynamic Sticky Bottom Footer */}
      {pricing && step < 3 && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)',
          maxWidth: '568px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid #d1fae5',
          borderRadius: '24px',
          padding: '16px 28px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
          animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated Total</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#059669', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              ${pricing.customerTotal.toFixed(2)}
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>incl. fees</span>
            </div>
          </div>
          <button
            style={{
              ...primaryBtn,
              width: 'auto',
              padding: '14px 28px',
              fontSize: '15px',
              boxShadow: '0 4px 10px rgba(5, 150, 105, 0.3)',
            }}
            onClick={() => {
              if (step === 2) {
                // Photo check
                if (!photos.front || !photos.back) {
                  setError('Please upload both front and back yard photos to continue.');
                  return;
                }
                setError('');
              }
              setStep(prev => prev + 1);
            }}
          >
            {step === 2 ? 'Review & Pay →' : 'Continue →'}
          </button>
        </div>
      )}
    </div>
  );
}

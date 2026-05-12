'use client';
import React, { useState, useEffect, useCallback } from 'react';

interface Provider {
  id: string; businessName: string; email: string | null; phone: string | null;
  profileStatus: string; isVerified: boolean; rating: number; reviewCount: number;
  bio: string | null; logoUrl: string | null; portfolioPhotos: string;
  vetoCount: number; googlePlaceId: string | null; createdAt: string;
  user: { name: string | null; email: string | null };
}
interface Job {
  id: string; status: string; address: string; zipCode: string;
  customerTotal: number; vetoCount: number; createdAt: string;
  customer: { name: string | null };
  provider: { businessName: string } | null;
}

export default function AdminPanel() {
  const [tab, setTab] = useState<'providers' | 'jobs'>('providers');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState('pending_review');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, jRes] = await Promise.all([
        fetch('/api/admin/providers'), fetch('/api/admin/jobs'),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setProviders(d.providers || []); }
      if (jRes.ok) { const d = await jRes.json(); setJobs(d.jobs || []); }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateProvider = async (id: string, status: string, reason?: string) => {
    setActionLoading(true);
    await fetch('/api/admin/providers', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: id, profileStatus: status, isVerified: status === 'verified', rejectionReason: reason }),
    });
    await fetchData(); setActionLoading(false);
  };

  const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12 };
  const btnS = (active: boolean): React.CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: 'none', background: active ? '#059669' : '#f1f5f9', color: active ? '#fff' : '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' });

  const filteredProviders = filter === 'all' ? providers : providers.filter(p => p.profileStatus === filter);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#166534', margin: 0 }}>🛡️ TERRAZAS ADMIN</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnS(tab === 'providers')} onClick={() => setTab('providers')}>Providers ({providers.length})</button>
            <button style={btnS(tab === 'jobs')} onClick={() => setTab('jobs')}>Jobs ({jobs.length})</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        {tab === 'providers' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {['pending_review', 'verified', 'draft', 'rejected', 'all'].map(f => (
                <button key={f} style={btnS(filter === f)} onClick={() => setFilter(f)}>{f.replace('_', ' ')} ({f === 'all' ? providers.length : providers.filter(p => p.profileStatus === f).length})</button>
              ))}
            </div>
            {loading ? <p>Loading...</p> : filteredProviders.map(p => (
              <div key={p.id} style={card}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {p.logoUrl ? <img src={p.logoUrl} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }} /> :
                    <div style={{ width: 48, height: 48, borderRadius: 10, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#64748b' }}>{p.businessName[0]}</div>}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{p.businessName}</h3>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: p.profileStatus === 'verified' ? '#d1fae5' : p.profileStatus === 'pending_review' ? '#fef3c7' : '#f1f5f9', fontWeight: 600 }}>{p.profileStatus}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{p.user.name || p.user.email} · {p.email} · {p.phone}</div>
                    {p.rating > 0 && <div style={{ fontSize: 12, color: '#059669' }}>{'★'.repeat(Math.round(p.rating))} {p.rating} ({p.reviewCount} reviews)</div>}
                    {p.googlePlaceId && <div style={{ fontSize: 11, color: '#3b82f6' }}>🔗 Google Business linked</div>}
                    {p.bio && <p style={{ fontSize: 13, color: '#475569', marginTop: 8, lineHeight: 1.5 }}>{p.bio}</p>}
                    {p.vetoCount > 0 && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>⚠️ {p.vetoCount} vetos received</div>}
                  </div>
                </div>
                {p.profileStatus === 'pending_review' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button disabled={actionLoading} onClick={() => updateProvider(p.id, 'verified')} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>✅ Approve</button>
                    <button disabled={actionLoading} onClick={() => { const reason = prompt('Rejection reason?'); if (reason) updateProvider(p.id, 'rejected', reason); }}
                      style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>❌ Reject</button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {tab === 'jobs' && (
          <>
            {loading ? <p>Loading...</p> : jobs.map(j => (
              <div key={j.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>📍 {j.address || j.zipCode}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{j.customer?.name || 'Unknown'} · {j.provider?.businessName || 'Unassigned'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: '#059669' }}>${j.customerTotal}</div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: j.status === 'completed' ? '#d1fae5' : '#fef3c7', fontWeight: 600 }}>{j.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}

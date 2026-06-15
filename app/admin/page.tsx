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
interface EscrowHold {
  id: string; providerId: string; jobId: string; amount: number;
  status: string; reason: string | null; releasedAt: string | null; createdAt: string;
  provider: { businessName: string; proTier: number; completedJobCount: number; escrowBalance: number; rating: number; user: { name: string | null; email: string | null } } | null;
}
interface EscrowSummary {
  totalHeld: number; totalReleased: number; totalClaimed: number;
  holdCount: number; providersWithHolds: number;
}

export default function AdminPanel() {
  const [tab, setTab] = useState<'providers' | 'jobs' | 'escrow' | 'disputes'>('providers');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [escrowHolds, setEscrowHolds] = useState<EscrowHold[]>([]);
  const [escrowSummary, setEscrowSummary] = useState<EscrowSummary | null>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState('pending_review');
  const [escrowFilter, setEscrowFilter] = useState<'held' | 'released' | 'claimed' | 'all'>('held');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, jRes, eRes, dRes] = await Promise.all([
        fetch('/api/admin/providers'), fetch('/api/admin/jobs'), fetch('/api/admin/escrow'), fetch('/api/admin/disputes'),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setProviders(d.providers || []); }
      if (jRes.ok) { const d = await jRes.json(); setJobs(d.jobs || []); }
      if (eRes.ok) { const d = await eRes.json(); setEscrowHolds(d.holds || []); setEscrowSummary(d.summary || null); }
      if (dRes.ok) { const d = await dRes.json(); setDisputes(d.disputes || []); }
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

  const escrowAction = async (action: string, holdId?: string, providerId?: string, reason?: string) => {
    setActionLoading(true);
    await fetch('/api/admin/escrow', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, holdId, providerId, reason }),
    });
    await fetchData(); setActionLoading(false);
  };

  const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12 };
  const btnS = (active: boolean): React.CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: 'none', background: active ? '#059669' : '#f1f5f9', color: active ? '#fff' : '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' });

  const filteredProviders = filter === 'all' ? providers : providers.filter(p => p.profileStatus === filter);
  const filteredHolds = escrowFilter === 'all' ? escrowHolds : escrowHolds.filter(h => h.status === escrowFilter);

  // Group escrow holds by provider
  const holdsByProvider = filteredHolds.reduce<Record<string, EscrowHold[]>>((acc, h) => {
    (acc[h.providerId] = acc[h.providerId] || []).push(h);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#166534', margin: 0 }}>🛡️ TERRAZAS ADMIN</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnS(tab === 'providers')} onClick={() => setTab('providers')}>Providers ({providers.length})</button>
            <button style={btnS(tab === 'jobs')} onClick={() => setTab('jobs')}>Jobs ({jobs.length})</button>
            <button style={{
              ...btnS(tab === 'escrow'),
              ...(tab === 'escrow' ? {} : { background: '#fffbeb', color: '#92400e' }),
            }} onClick={() => setTab('escrow')}>
              🔒 Escrow {escrowSummary ? `($${escrowSummary.totalHeld})` : ''}
            </button>
            <button style={{
              ...btnS(tab === 'disputes'),
              ...(tab === 'disputes' ? {} : { background: '#fef2f2', color: '#991b1b' }),
            }} onClick={() => setTab('disputes')}>
              ⚠️ Disputes ({disputes.length})
            </button>
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

        {/* ── ESCROW MANAGEMENT TAB ── */}
        {tab === 'escrow' && (
          <>
            {/* Summary Cards */}
            {escrowSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>🔒 HELD</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#92400e' }}>${escrowSummary.totalHeld.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: '#b45309' }}>{escrowSummary.holdCount} holds · {escrowSummary.providersWithHolds} providers</div>
                </div>
                <div style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#166534', marginBottom: 4 }}>✅ RELEASED</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#166534' }}>${escrowSummary.totalReleased.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: '#15803d' }}>Returned to providers</div>
                </div>
                <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>⚠️ CLAIMED</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#991b1b' }}>${escrowSummary.totalClaimed.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: '#b91c1c' }}>Used for damage coverage</div>
                </div>
              </div>
            )}

            {/* Filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['held', 'released', 'claimed', 'all'] as const).map(f => (
                <button key={f} style={btnS(escrowFilter === f)} onClick={() => setEscrowFilter(f)}>
                  {f === 'held' ? '🔒' : f === 'released' ? '✅' : f === 'claimed' ? '⚠️' : '📋'} {f} ({f === 'all' ? escrowHolds.length : escrowHolds.filter(h => h.status === f).length})
                </button>
              ))}
            </div>

            {/* Holds grouped by provider */}
            {loading ? <p>Loading...</p> : Object.keys(holdsByProvider).length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#475569' }}>No escrow holds</h3>
                <p style={{ fontSize: 13, color: '#94a3b8' }}>Escrow holds appear when Community Pros complete jobs.</p>
              </div>
            ) : Object.entries(holdsByProvider).map(([providerId, holds]) => {
              const provider = holds[0].provider;
              const providerHeldTotal = holds.filter(h => h.status === 'held').reduce((s, h) => s + h.amount, 0);
              const hasHeldHolds = holds.some(h => h.status === 'held');

              return (
                <div key={providerId} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  {/* Provider header */}
                  <div style={{ padding: '14px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{provider?.businessName || 'Unknown'}</h4>
                        <span style={{
                          fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                          background: provider?.proTier === 0 ? '#f1f5f9' : '#d1fae5',
                          color: provider?.proTier === 0 ? '#64748b' : '#166534',
                        }}>
                          {provider?.proTier === 0 ? 'Community' : 'Verified'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {provider?.user?.name} · {provider?.completedJobCount || 0} jobs · {provider?.rating?.toFixed(1) || '0'}★
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {providerHeldTotal > 0 && (
                        <>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#92400e' }}>${providerHeldTotal.toFixed(2)}</div>
                          <button
                            disabled={actionLoading}
                            onClick={() => { if (confirm(`Release all $${providerHeldTotal.toFixed(2)} held escrow for ${provider?.businessName}?`)) escrowAction('release_all', undefined, providerId); }}
                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontWeight: 600, fontSize: 11, cursor: 'pointer', marginTop: 4 }}
                          >
                            Release All
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Individual holds */}
                  {holds.map(hold => (
                    <div key={hold.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          ${hold.amount.toFixed(2)}
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 4, marginLeft: 8, fontWeight: 600,
                            background: hold.status === 'held' ? '#fef3c7' : hold.status === 'released' ? '#d1fae5' : '#fecaca',
                            color: hold.status === 'held' ? '#92400e' : hold.status === 'released' ? '#166534' : '#991b1b',
                          }}>
                            {hold.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          Job: {hold.jobId.slice(0, 8)}… · {new Date(hold.createdAt).toLocaleDateString()}
                          {hold.reason && <span style={{ color: '#ef4444' }}> · {hold.reason}</span>}
                        </div>
                      </div>
                      {hold.status === 'held' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            disabled={actionLoading}
                            onClick={() => escrowAction('release_one', hold.id)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', background: '#fff', color: '#059669', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                          >
                            Release
                          </button>
                          <button
                            disabled={actionLoading}
                            onClick={() => { const reason = prompt('Damage description:'); if (reason) escrowAction('claim', hold.id, undefined, reason); }}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                          >
                            Claim
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}

        {/* ── DISPUTES RESOLUTION TAB ── */}
        {tab === 'disputes' && (
          <>
            {loading ? <p>Loading...</p> : disputes.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🛡️</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#475569' }}>No pending disputes</h3>
                <p style={{ fontSize: 13, color: '#94a3b8' }}>Disputed jobs will show up here for resolution.</p>
              </div>
            ) : disputes.map(dispute => {
              return (
                <div key={dispute.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 10, marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: dispute.disputeStatus === 'pending' ? '#fef3c7' : dispute.disputeStatus === 'pending_flagged' ? '#fee2e2' : '#f1f5f9', color: dispute.disputeStatus === 'pending_flagged' ? '#991b1b' : dispute.disputeStatus === 'pending' ? '#92400e' : '#475569', fontWeight: 700 }}>
                        ⚠️ {dispute.disputeStatus?.toUpperCase()}
                      </span>
                      {dispute.disputeStatus === 'pending_flagged' && (
                        <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 'bold', marginLeft: 8 }}>⚠️ High Dispute Rate (Abuse Flagged)</span>
                      )}
                      <h4 style={{ fontSize: 15, fontWeight: 700, margin: '6px 0 0 0' }}>Job ID: {dispute.id.slice(0, 8)}… · {dispute.serviceType}</h4>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>${dispute.customerTotal}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Disputed {dispute.disputedAt ? new Date(dispute.disputedAt).toLocaleDateString() : ''}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13, marginBottom: 12 }}>
                    <div>
                      <strong>Customer:</strong> {dispute.customer?.name || 'Unknown'}
                      <div style={{ color: '#475569', marginTop: 4, background: '#f8fafc', padding: 8, borderRadius: 8, fontStyle: 'italic' }}>
                        &ldquo;{dispute.disputeReason}&rdquo;
                      </div>
                    </div>
                    <div>
                      <strong>Provider:</strong> {dispute.provider?.businessName || 'Unassigned'}
                      <div style={{ color: '#475569', marginTop: 4 }}>
                        Status before completion: {dispute.status}
                      </div>
                    </div>
                  </div>

                  {/* Photo Evidence Side-by-Side */}
                  <div style={{ margin: '12px 0', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                    <strong>Evidence Photos:</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Customer Claim Photo</div>
                        {dispute.disputePhotoUrl ? (
                          <img src={dispute.disputePhotoUrl} alt="Customer Evidence" style={{ width: '100%', maxHeight: '180px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                        ) : (
                          <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: '8px', color: '#94a3b8', fontSize: 12 }}>No photo evidence</div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Provider Completion Photo</div>
                        {dispute.photoAfterUrl ? (
                          <img src={dispute.photoAfterUrl} alt="Provider Completion" style={{ width: '100%', maxHeight: '180px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                        ) : (
                          <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: '8px', color: '#94a3b8', fontSize: 12 }}>No completion photo</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {(dispute.disputeStatus === 'pending' || dispute.disputeStatus === 'pending_flagged') && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button 
                        disabled={actionLoading} 
                        onClick={async () => {
                          if (confirm(`Approve dispute and refund customer $${dispute.customerTotal}?`)) {
                            setActionLoading(true);
                            await fetch(`/api/admin/disputes`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ jobId: dispute.id, action: 'refund' }),
                            });
                            await fetchData();
                            setActionLoading(false);
                          }
                        }} 
                        style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Refund Customer
                      </button>
                      <button 
                        disabled={actionLoading} 
                        onClick={async () => {
                          if (confirm('Reject dispute and release escrow funds to provider?')) {
                            setActionLoading(true);
                            await fetch(`/api/admin/disputes`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ jobId: dispute.id, action: 'reject' }),
                            });
                            await fetchData();
                            setActionLoading(false);
                          }
                        }} 
                        style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Reject Dispute (Release Funds)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}

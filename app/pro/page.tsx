'use client';
import React, { useState, useEffect } from 'react';
import { JOB_STATUS_LABELS } from '@/lib/constants';

interface JobItem {
  id: string; status: string; serviceType: string; tier: string; zipCode: string;
  address: string; price: number; providerPayout: number; customerTotal: number;
  aiWarning: boolean; conditionNotes: string | null; createdAt: string;
  customer?: { name: string | null };
}

interface ProviderInfo {
  id: string;
  proTier: number;
  upgradeEligible: boolean;
  completedJobCount: number;
  rating: number;
  escrowBalance: number;
  maxActiveJobs: number;
  equipmentTag: string | null;
}

interface PayoutInfo {
  pendingBalance: number;
  availableBalance: number;
  escrowHeld: number;
  nextPayoutDate: string;
  holdDays: number;
  canInstant: boolean;
  instantFee: number;
  freeInstant: boolean;
  recentPayouts: any[];
  lifetimeEarnings: number;
}

export default function ProDashboard() {
  const [tab, setTab] = useState<'feed' | 'myjobs' | 'earnings'>('feed');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [myJobs, setMyJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [selectedEta, setSelectedEta] = useState<Record<string, number>>({});
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [showUpgradeDetails, setShowUpgradeDetails] = useState(false);
  const [payoutInfo, setPayoutInfo] = useState<PayoutInfo | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [instantResult, setInstantResult] = useState<string | null>(null);

  // Fetch broadcast jobs + provider info
  const fetchJobs = async () => {
    try {
      const [bRes, mRes, pRes] = await Promise.all([
        fetch('/api/jobs?status=broadcast'),
        fetch('/api/jobs?status=active,en_route,in_progress,pending_approval'),
        fetch('/api/provider/me'),
      ]);
      const bData = await bRes.json(); setJobs(bData.jobs || []);
      const mData = await mRes.json(); setMyJobs(mData.jobs || []);
      if (pRes.ok) { const pData = await pRes.json(); setProviderInfo(pData.provider || null); }
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { fetchJobs(); const i = setInterval(fetchJobs, 10000); return () => clearInterval(i); }, []);

  const claimJob = async (jobId: string) => {
    setClaiming(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/claim`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etaMinutes: selectedEta[jobId] || 30 }),
      });
      const data = await res.json();
      if (!data.success && !res.ok) alert(data.error || 'Job unavailable');
      else { setJobs(prev => prev.filter(j => j.id !== jobId)); fetchJobs(); }
    } catch { alert('Failed to claim'); } finally { setClaiming(null); }
  };

  const updateStatus = async (jobId: string, newStatus: string) => {
    setStatusLoading(jobId);
    try {
      await fetch('/api/jobs/status', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: newStatus }),
      });
      await fetchJobs();
    } catch {} finally { setStatusLoading(null); }
  };

  const uploadCompletionPhoto = async (jobId: string, file: File) => {
    const fd = new FormData(); fd.append('file', file); fd.append('folder', 'completion');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.url) {
      // Update job with completion photo, then mark complete
      await fetch('/api/jobs/status', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: 'completed', photoAfterUrl: data.url }),
      });
      await fetchJobs();
    }
  };

  const STATUS_FLOW: Record<string, { next: string; label: string; icon: string }> = {
    active: { next: 'en_route', label: 'On My Way', icon: '🚗' },
    en_route: { next: 'in_progress', label: 'Start Working', icon: '🔧' },
    in_progress: { next: 'completed', label: 'Upload & Complete', icon: '📸' },
  };

  if (loading) return <div style={{ background: '#0f172a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Loading...</div>;

  const isCommunityPro = providerInfo?.proTier === 0;
  const upgradeProgress = providerInfo ? Math.min(providerInfo.completedJobCount / 20, 1) : 0;

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <header style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 10, background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>TERRAZAS PRO</h1>
            {isCommunityPro && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#1e293b', color: '#94a3b8', fontWeight: 600 }}>COMMUNITY</span>}
            {providerInfo?.proTier === 1 && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#059669', color: '#fff', fontWeight: 600 }}>✓ VERIFIED</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setTab('feed')} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: tab === 'feed' ? '#059669' : '#1e293b', color: tab === 'feed' ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              📡 Feed ({jobs.length})
            </button>
            <button onClick={() => setTab('myjobs')} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: tab === 'myjobs' ? '#059669' : '#1e293b', color: tab === 'myjobs' ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              🔧 My Jobs ({myJobs.length})
            </button>
            <button onClick={async () => {
              setTab('earnings');
              if (providerInfo?.id) {
                const res = await fetch(`/api/provider/payout?providerId=${providerInfo.id}`);
                if (res.ok) { const d = await res.json(); setPayoutInfo(d.payout); }
              }
            }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: tab === 'earnings' ? '#059669' : '#1e293b', color: tab === 'earnings' ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              💰 Earnings
            </button>
          </div>
        </div>
      </header>

      <div style={{ padding: '16px', paddingBottom: 80 }}>

        {/* ── Upgrade CTA Banner ── */}
        {providerInfo?.upgradeEligible && isCommunityPro && !showUpgradeDetails && (
          <div style={{
            background: 'linear-gradient(135deg, #059669, #047857)',
            borderRadius: 16,
            padding: '20px 20px',
            marginBottom: 16,
            border: '1px solid #34d399',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.1 }}>🎉</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, marginBottom: 6 }}>🎉 You qualify for Verified Pro!</h3>
            <p style={{ fontSize: 13, color: '#d1fae5', margin: 0, marginBottom: 12, lineHeight: 1.5 }}>
              {providerInfo.completedJobCount} jobs completed · {providerInfo.rating.toFixed(1)}★ rating
            </p>
            <p style={{ fontSize: 12, color: '#a7f3d0', margin: 0, marginBottom: 16 }}>
              Unlock premium jobs, unlimited active jobs, higher payouts, and the Terrazas Pro-Pack insurance discount.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowUpgradeDetails(true)} style={{
                flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                background: '#fff', color: '#047857', fontWeight: 800, fontSize: 14, cursor: 'pointer',
              }}>
                Learn More →
              </button>
              <button onClick={() => setShowUpgradeDetails(false)} style={{
                padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)',
                background: 'transparent', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}>
                Later
              </button>
            </div>
          </div>
        )}

        {/* ── Upgrade Details Panel ── */}
        {showUpgradeDetails && (
          <div style={{
            background: '#1e293b',
            borderRadius: 16,
            padding: 24,
            marginBottom: 16,
            border: '1px solid #334155',
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>⬆️ Upgrade to Verified Pro</h3>

            <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
              {[
                { icon: '💰', title: 'Higher Payouts', desc: 'Access premium jobs over $50 with no price cap' },
                { icon: '🔓', title: 'Unlimited Jobs', desc: 'No cap on concurrent active jobs' },
                { icon: '🏡', title: 'All Properties', desc: 'Large lots, complex terrain, pool homes — all unlocked' },
                { icon: '🛡️', title: 'Verified Badge', desc: 'Build trust with the ✓ badge on your profile' },
                { icon: '📋', title: 'Insurance Discount', desc: 'Terrazas Pro-Pack: discounted General Liability referral' },
              ].map((b) => (
                <div key={b.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, background: '#0f172a', borderRadius: 10 }}>
                  <span style={{ fontSize: 24 }}>{b.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{b.title}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: 16, background: '#0f172a', borderRadius: 12, marginBottom: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>What you need:</h4>
              <ul style={{ paddingLeft: 20, fontSize: 13, color: '#94a3b8', lineHeight: 1.8, margin: 0 }}>
                <li>Proof of General Liability Insurance</li>
                <li>Business license (if required in your area)</li>
                <li>Our team will review and activate within 24 hours</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <a href="mailto:support@terrazas.app?subject=Verified%20Pro%20Upgrade&body=I'd%20like%20to%20upgrade%20to%20Verified%20Pro.%20My%20provider%20ID%20is%20attached."
                style={{
                  flex: 1, padding: '14px', borderRadius: 12, border: 'none', textDecoration: 'none', textAlign: 'center',
                  background: '#059669', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'block',
                }}>
                📧 Start Upgrade
              </a>
              <button onClick={() => setShowUpgradeDetails(false)} style={{
                padding: '14px 20px', borderRadius: 12, border: '1px solid #334155',
                background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── Community Pro Progress Tracker ── */}
        {isCommunityPro && !providerInfo?.upgradeEligible && (
          <div style={{
            background: '#1e293b',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 12,
            border: '1px solid #334155',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>⬆️ Upgrade Progress</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>{providerInfo?.completedJobCount || 0}/20 jobs · {providerInfo?.rating.toFixed(1) || '0.0'}★</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: '#0f172a', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${upgradeProgress * 100}%`, background: 'linear-gradient(90deg, #059669, #34d399)', borderRadius: 3, transition: 'width 0.5s ease' }} />
            </div>
            <p style={{ fontSize: 10, color: '#475569', marginTop: 6, margin: 0 }}>
              Complete 20 jobs with a 4.8★+ rating to unlock Verified Pro
            </p>
          </div>
        )}
        {/* BROADCAST FEED */}
        {tab === 'feed' && (
          jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
              <div style={{ fontSize: 48 }}>📡</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>No jobs right now</h2>
              <p style={{ fontSize: 13 }}>New jobs appear automatically. Keep this open.</p>
            </div>
          ) : jobs.map(job => {
            const statusInfo = JOB_STATUS_LABELS[job.status] || { label: job.status, color: '' };
            return (
              <div key={job.id} style={{ background: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 12, border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#059669', color: '#fff', fontWeight: 700 }}>{statusInfo.label}</span>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>{job.serviceType?.replace('_', ' ')} — {job.tier}</h3>
                    <p style={{ fontSize: 13, color: '#94a3b8' }}>📍 {job.address || job.zipCode}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#34d399' }}>${job.providerPayout || job.price}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>YOUR PAYOUT</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
                  {[15, 30, 45].map(min => (
                    <button key={min} onClick={() => setSelectedEta(p => ({ ...p, [job.id]: min }))}
                      style={{ padding: '10px', borderRadius: 10, border: (selectedEta[job.id] || 30) === min ? '2px solid #059669' : '1px solid #334155', background: (selectedEta[job.id] || 30) === min ? '#059669' : '#0f172a', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      {min} MIN
                    </button>
                  ))}
                </div>
                <button onClick={() => claimJob(job.id)} disabled={claiming === job.id}
                  style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#059669', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', opacity: claiming === job.id ? 0.5 : 1 }}>
                  {claiming === job.id ? 'CLAIMING...' : `CLAIM — ${selectedEta[job.id] || 30} MIN ETA`}
                </button>
              </div>
            );
          })
        )}

        {/* MY JOBS */}
        {tab === 'myjobs' && (
          myJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
              <div style={{ fontSize: 48 }}>🔧</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>No active jobs</h2>
              <p style={{ fontSize: 13 }}>Claim a job from the feed to get started.</p>
            </div>
          ) : myJobs.map(job => {
            const flow = STATUS_FLOW[job.status];
            return (
              <div key={job.id} style={{ background: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 12, border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>📍 {job.address || job.zipCode}</h3>
                    <p style={{ fontSize: 13, color: '#94a3b8' }}>{job.serviceType?.replace('_', ' ')} — {job.tier}</p>
                    {job.customer?.name && <p style={{ fontSize: 12, color: '#64748b' }}>Customer: {job.customer.name}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#34d399' }}>${job.providerPayout || job.price}</div>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: job.status === 'pending_approval' ? '#fef3c7' : '#059669', color: job.status === 'pending_approval' ? '#92400e' : '#fff', fontWeight: 700 }}>
                      {job.status === 'pending_approval' ? '⏳ Awaiting approval' : job.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                {/* Status update button */}
                {flow && (
                  flow.next === 'completed' ? (
                    <label style={{ display: 'block', width: '100%', padding: 14, borderRadius: 12, background: '#059669', color: '#fff', fontWeight: 800, fontSize: 14, textAlign: 'center', cursor: 'pointer', marginTop: 8 }}>
                      {flow.icon} {flow.label}
                      <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                        onChange={e => { if (e.target.files?.[0]) uploadCompletionPhoto(job.id, e.target.files[0]); }} />
                    </label>
                  ) : (
                    <button onClick={() => updateStatus(job.id, flow.next)} disabled={statusLoading === job.id}
                      style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#059669', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', marginTop: 8, opacity: statusLoading === job.id ? 0.5 : 1 }}>
                      {flow.icon} {flow.label}
                    </button>
                  )
                )}
              </div>
            );
          })
        )}

        {/* ── EARNINGS / PAYOUT TAB ── */}
        {tab === 'earnings' && (
          <div>
            {/* Balance Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ background: '#1e293b', borderRadius: 14, padding: '16px', border: '1px solid #334155' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>PENDING</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#fbbf24' }}>${payoutInfo?.pendingBalance.toFixed(2) || '0.00'}</div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{payoutInfo?.holdDays || 3}-day hold</div>
              </div>
              <div style={{ background: '#1e293b', borderRadius: 14, padding: '16px', border: '1px solid #059669' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>AVAILABLE</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#34d399' }}>${payoutInfo?.availableBalance.toFixed(2) || '0.00'}</div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Ready to withdraw</div>
              </div>
            </div>

            {/* Escrow notice (Community Pro only) */}
            {isCommunityPro && (payoutInfo?.escrowHeld || 0) > 0 && (
              <div style={{ background: '#1e293b', borderRadius: 12, padding: '12px 14px', marginBottom: 12, border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>🔒 Platform Protection Fund</div>
                  <div style={{ fontSize: 10, color: '#475569' }}>5% held on first 10 jobs · released after clean record</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fbbf24' }}>${payoutInfo?.escrowHeld.toFixed(2)}</div>
              </div>
            )}

            {/* Instant Payout Button */}
            <div style={{ background: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 12, border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>⚡ Instant Payout</h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0, marginTop: 4 }}>
                    {payoutInfo?.freeInstant ? (
                      <span style={{ color: '#34d399', fontWeight: 700 }}>✓ FREE with Verified Pro</span>
                    ) : (
                      <span>${payoutInfo?.instantFee.toFixed(2) || '1.99'} fee per transfer</span>
                    )}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#34d399' }}>${payoutInfo?.availableBalance.toFixed(2) || '0.00'}</div>
                  {!payoutInfo?.freeInstant && payoutInfo?.availableBalance && payoutInfo.availableBalance > 0 && (
                    <div style={{ fontSize: 10, color: '#475569' }}>You receive: ${(payoutInfo.availableBalance - payoutInfo.instantFee).toFixed(2)}</div>
                  )}
                </div>
              </div>

              {instantResult && (
                <div style={{ padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 12, background: instantResult.startsWith('✅') ? '#052e16' : '#450a0a', color: instantResult.startsWith('✅') ? '#34d399' : '#fca5a5' }}>
                  {instantResult}
                </div>
              )}

              <button
                disabled={payoutLoading || !payoutInfo?.canInstant}
                onClick={async () => {
                  if (!providerInfo?.id) return;
                  setPayoutLoading(true); setInstantResult(null);
                  try {
                    const res = await fetch('/api/provider/payout', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ providerId: providerInfo.id, action: 'instant' }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setInstantResult(`✅ $${data.payout.netPayout.toFixed(2)} sent to your bank!${data.payout.fee > 0 ? ` ($${data.payout.fee.toFixed(2)} fee)` : ' (No fee)'}`);
                      // Refresh payout info
                      const r2 = await fetch(`/api/provider/payout?providerId=${providerInfo.id}`);
                      if (r2.ok) { const d2 = await r2.json(); setPayoutInfo(d2.payout); }
                    } else {
                      setInstantResult(`❌ ${data.error}`);
                    }
                  } catch { setInstantResult('❌ Failed to process payout'); }
                  setPayoutLoading(false);
                }}
                style={{
                  width: '100%', padding: 14, borderRadius: 12, border: 'none',
                  background: payoutInfo?.canInstant ? 'linear-gradient(135deg, #059669, #047857)' : '#1e293b',
                  color: payoutInfo?.canInstant ? '#fff' : '#475569',
                  fontWeight: 800, fontSize: 15, cursor: payoutInfo?.canInstant ? 'pointer' : 'not-allowed',
                  opacity: payoutLoading ? 0.5 : 1,
                }}
              >
                {payoutLoading ? 'Processing...' : payoutInfo?.canInstant ? '⚡ Cash Out Now' : 'No funds available'}
              </button>
            </div>

            {/* Weekly Payout Schedule */}
            <div style={{ background: '#1e293b', borderRadius: 14, padding: '16px', marginBottom: 12, border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>📅 Next Weekly Payout</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Every Friday at 5:00 PM · automatic</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>
                  {payoutInfo?.nextPayoutDate ? new Date(payoutInfo.nextPayoutDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
                </div>
              </div>
            </div>

            {/* Lifetime Stats */}
            <div style={{ background: '#1e293b', borderRadius: 14, padding: '16px', marginBottom: 16, border: '1px solid #334155' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>LIFETIME EARNINGS</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>${payoutInfo?.lifetimeEarnings.toFixed(2) || '0.00'}</div>
            </div>

            {/* Recent Payouts */}
            {payoutInfo?.recentPayouts && payoutInfo.recentPayouts.length > 0 && (
              <div style={{ background: '#1e293b', borderRadius: 14, padding: '16px', border: '1px solid #334155' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, marginBottom: 12 }}>Recent Payouts</h4>
                {payoutInfo.recentPayouts.map((p: any) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #0f172a' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {p.type === 'instant' ? '⚡' : '📅'} ${p.netAmount.toFixed(2)}
                        {p.instantFee > 0 && <span style={{ fontSize: 10, color: '#64748b' }}> (−${p.instantFee.toFixed(2)} fee)</span>}
                      </div>
                      <div style={{ fontSize: 10, color: '#475569' }}>{new Date(p.createdAt).toLocaleDateString()}</div>
                    </div>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                      background: p.status === 'completed' ? '#052e16' : p.status === 'failed' ? '#450a0a' : '#1e293b',
                      color: p.status === 'completed' ? '#34d399' : p.status === 'failed' ? '#fca5a5' : '#94a3b8',
                    }}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Payout info footer */}
            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
              {isCommunityPro ? (
                <>
                  Community Pro · {payoutInfo?.holdDays}-day hold · ${payoutInfo?.instantFee.toFixed(2)} instant fee<br />
                  <span style={{ color: '#059669' }}>Upgrade to Verified Pro for FREE instant payouts →</span>
                </>
              ) : (
                <>Verified Pro · {payoutInfo?.holdDays}-day hold · Free instant payouts ✓</>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';
import React, { useState, useEffect, useCallback } from 'react';

interface Job {
  id: string; status: string; address: string; zipCode: string; scope: string;
  price: number; customerTotal: number; providerPayout: number; serviceFee: number;
  createdAt: string; claimedAt: string | null; approvedAt: string | null; completedAt: string | null;
  approvalDeadline: string | null; autoApproved: boolean; vetoCount: number;
  provider?: { id: string; businessName: string; logoUrl: string | null; rating: number; reviewCount: number; bio: string | null; portfolioPhotos: string; isVerified: boolean; };
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  broadcast: { bg: '#fef3c7', text: '#92400e', label: '📡 Waiting for provider' },
  pending_approval: { bg: '#dbeafe', text: '#1e40af', label: '⏳ Provider claimed — review now' },
  active: { bg: '#d1fae5', text: '#065f46', label: '✅ Provider approved' },
  en_route: { bg: '#e0e7ff', text: '#3730a3', label: '🚗 Provider on the way' },
  in_progress: { bg: '#fce7f3', text: '#9d174d', label: '🔧 In progress' },
  completed: { bg: '#f0fdf4', text: '#166534', label: '✅ Completed' },
  cancelled: { bg: '#fef2f2', text: '#991b1b', label: '❌ Cancelled' },
  manual_match: { bg: '#fff7ed', text: '#9a3412', label: '🤝 Being matched manually' },
};

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [vetoReason, setVetoReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs?role=customer');
      if (res.ok) { const data = await res.json(); setJobs(data.jobs || []); }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchJobs(); const i = setInterval(fetchJobs, 15000); return () => clearInterval(i); }, [fetchJobs]);

  const approveProvider = async (jobId: string) => {
    setActionLoading(true);
    await fetch(`/api/jobs/${jobId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    await fetchJobs(); setActionLoading(false);
  };

  const vetoProvider = async (jobId: string) => {
    setActionLoading(true);
    await fetch(`/api/jobs/${jobId}/veto`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: vetoReason || undefined }) });
    setVetoReason(''); await fetchJobs(); setActionLoading(false);
  };

  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 12 };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 50%, #f0fdf4 100%)', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none' }}><h1 style={{ fontSize: 22, fontWeight: 900, color: '#166534', margin: 0 }}>TERRAZAS</h1></a>
          <a href="/post" style={{ padding: '8px 16px', borderRadius: 8, background: '#059669', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>+ New Job</a>
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 80px' }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>My Jobs</h2>

        {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : jobs.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No jobs yet</h3>
            <p style={{ color: '#64748b', marginBottom: 20 }}>Post your first job and get a pro out today!</p>
            <a href="/post" style={{ padding: '12px 24px', borderRadius: 12, background: '#059669', color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Post a Job</a>
          </div>
        ) : jobs.map(job => {
          const status = STATUS_COLORS[job.status] || STATUS_COLORS.broadcast;
          const isPending = job.status === 'pending_approval';
          const deadline = job.approvalDeadline ? new Date(job.approvalDeadline) : null;
          const isSelected = selectedJob === job.id;

          return (
            <div key={job.id} style={card} onClick={() => setSelectedJob(isSelected ? null : job.id)}>
              {/* Status badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ padding: '4px 10px', borderRadius: 6, background: status.bg, color: status.text, fontSize: 12, fontWeight: 700 }}>{status.label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>${job.customerTotal.toFixed(2)}</span>
              </div>

              {/* Address */}
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>📍 {job.address || job.zipCode}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{new Date(job.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>

              {/* Provider card (when claimed) */}
              {isPending && job.provider && (
                <div style={{ marginTop: 12, padding: 16, borderRadius: 12, background: '#f0fdf4', border: '2px solid #059669' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18 }}>
                      {job.provider.logoUrl ? <img src={job.provider.logoUrl} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} /> : job.provider.businessName[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{job.provider.businessName}</div>
                      <div style={{ fontSize: 13, color: '#059669' }}>
                        {'★'.repeat(Math.round(job.provider.rating))} {job.provider.rating.toFixed(1)} ({job.provider.reviewCount} reviews)
                        {job.provider.isVerified && ' · ✅ Verified'}
                      </div>
                    </div>
                  </div>
                  {job.provider.bio && <p style={{ fontSize: 13, color: '#475569', marginBottom: 12, lineHeight: 1.5 }}>{job.provider.bio}</p>}

                  {/* Countdown timer */}
                  {deadline && <CountdownTimer deadline={deadline} />}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button disabled={actionLoading} onClick={(e) => { e.stopPropagation(); approveProvider(job.id); }}
                      style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      ✅ Approve
                    </button>
                    <button disabled={actionLoading} onClick={(e) => { e.stopPropagation(); vetoProvider(job.id); }}
                      style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      ❌ Choose Someone Else
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>Auto-approves if no action taken • Veto {job.vetoCount}/3</div>
                </div>
              )}

              {/* Completed — leave review */}
              {job.status === 'completed' && (
                <a href={`/review?jobId=${job.id}`} style={{ display: 'block', marginTop: 12, padding: '10px', borderRadius: 10, background: '#fef3c7', textAlign: 'center', color: '#92400e', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                  ⭐ Leave a Review
                </a>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}

// Countdown timer component
function CountdownTimer({ deadline }: { deadline: Date }) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = deadline.getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Auto-approving...'); return; }
      const m = Math.floor(diff / 60000); const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
    };
    tick(); const i = setInterval(tick, 1000); return () => clearInterval(i);
  }, [deadline]);
  return <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, color: '#059669', padding: '8px 0' }}>⏳ Auto-approves in {timeLeft}</div>;
}

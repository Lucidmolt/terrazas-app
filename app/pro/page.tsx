'use client';
import React, { useState, useEffect } from 'react';
import { JOB_STATUS_LABELS } from '@/lib/constants';

interface JobItem {
  id: string; status: string; serviceType: string; tier: string; zipCode: string;
  address: string; price: number; providerPayout: number; customerTotal: number;
  aiWarning: boolean; conditionNotes: string | null; createdAt: string;
  customer?: { name: string | null };
}

export default function ProDashboard() {
  const [tab, setTab] = useState<'feed' | 'myjobs'>('feed');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [myJobs, setMyJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [selectedEta, setSelectedEta] = useState<Record<string, number>>({});
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  // Fetch broadcast jobs
  const fetchJobs = async () => {
    try {
      const [bRes, mRes] = await Promise.all([
        fetch('/api/jobs?status=broadcast'),
        fetch('/api/jobs?status=active,en_route,in_progress,pending_approval'),
      ]);
      const bData = await bRes.json(); setJobs(bData.jobs || []);
      const mData = await mRes.json(); setMyJobs(mData.jobs || []);
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

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <header style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 10, background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>TERRAZAS PRO</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setTab('feed')} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: tab === 'feed' ? '#059669' : '#1e293b', color: tab === 'feed' ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              📡 Feed ({jobs.length})
            </button>
            <button onClick={() => setTab('myjobs')} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: tab === 'myjobs' ? '#059669' : '#1e293b', color: tab === 'myjobs' ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              🔧 My Jobs ({myJobs.length})
            </button>
          </div>
        </div>
      </header>

      <div style={{ padding: '16px', paddingBottom: 80 }}>
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
      </div>
    </div>
  );
}

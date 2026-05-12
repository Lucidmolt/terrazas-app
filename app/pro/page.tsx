'use client';

import React, { useState, useEffect } from 'react';
import { JOB_STATUS_LABELS } from '@/lib/constants';

interface JobItem {
  id: string;
  status: string;
  serviceType: string;
  tier: string;
  zipCode: string;
  address: string;
  price: number;
  aiWarning: boolean;
  conditionNotes: string | null;
  createdAt: string;
}

export default function ProDashboard() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [selectedEta, setSelectedEta] = useState<Record<string, number>>({});
  const [earnings, setEarnings] = useState({ tips: 0, tipCount: 0 });

  // ── Fetch Available Jobs ─────────────────────────────────────────
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch('/api/jobs?status=broadcast');
        const data = await res.json();
        setJobs(data.jobs || []);
      } catch (err) {
        console.error('[Pro] Failed to fetch jobs:', err);
      }
      setLoading(false);
    };

    fetchJobs();

    // Poll every 10 seconds for new jobs
    const interval = setInterval(fetchJobs, 10_000);
    return () => clearInterval(interval);
  }, []);

  // ── Fetch Earnings ───────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/tips?providerId=demo')
      .then((r) => r.json())
      .then((data) => setEarnings({ tips: data.total || 0, tipCount: data.count || 0 }))
      .catch(() => {});
  }, []);

  // ── Claim Job ────────────────────────────────────────────────────
  const claimJob = async (jobId: string) => {
    const eta = selectedEta[jobId] || 30;
    setClaiming(jobId);

    try {
      const res = await fetch('/api/jobs/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          providerId: 'demo-provider', // TODO: replace with real auth
          etaMinutes: eta,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        alert(data.message || 'Job is no longer available.');
      } else {
        // Remove from list
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
      }
    } catch (err) {
      console.error('[Pro] Claim failed:', err);
      alert('Failed to claim job.');
    } finally {
      setClaiming(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-slate-900 min-h-screen text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 glass-dark border-b border-slate-800 px-6 py-5 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tighter">LIVE FEED</h1>
          <p className="text-micro text-slate-500 mt-1">Terrazas Pro Dashboard</p>
        </div>
        <div className="flex items-center space-x-3">
          {earnings.tips > 0 && (
            <div className="bg-yellow-500/20 text-yellow-300 px-3 py-1.5 rounded-full text-xs font-bold flex items-center space-x-2">
              <span>💰</span>
              <span>${earnings.tips.toFixed(2)} tips</span>
            </div>
          )}
          <div className="bg-brand-500/20 text-brand-400 px-3 py-1.5 rounded-full text-xs font-bold animate-pulse flex items-center space-x-2">
            <div className="w-2 h-2 bg-brand-400 rounded-full" />
            <span>{jobs.length} JOBS</span>
          </div>
          <a href="/" className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">✕</a>
        </div>
      </header>

      {/* Job Feed */}
      <div className="p-4 space-y-4 pb-24">
        {jobs.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-6xl">📡</div>
            <h2 className="text-xl font-bold text-slate-400">No jobs right now</h2>
            <p className="text-sm text-slate-600">New jobs will appear here automatically. Keep this screen open.</p>
          </div>
        ) : (
          jobs.map((job) => {
            const statusInfo = JOB_STATUS_LABELS[job.status] || { label: job.status, color: 'text-slate-400 bg-slate-800' };
            return (
              <div key={job.id} className="bg-slate-800 rounded-5xl p-6 border border-slate-700 shadow-2xl transition-all hover:border-slate-600">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`status-pill ${statusInfo.color}`}>{statusInfo.label}</span>
                      {job.aiWarning && <span className="badge badge-live">⚠️ AI Warning</span>}
                    </div>
                    <h2 className="text-xl font-bold capitalize">{job.serviceType?.replace('_', ' ')} — {job.tier}</h2>
                    <p className="text-slate-400 text-sm mt-1">📍 {job.address || job.zipCode}</p>
                    {job.conditionNotes && <p className="text-slate-500 text-xs mt-1 italic">{job.conditionNotes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-brand-400">${job.price}</p>
                    <p className="text-micro text-slate-500">EST. 45 MIN</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[15, 30, 45].map((min) => (
                    <button key={min} onClick={() => setSelectedEta((prev) => ({ ...prev, [job.id]: min }))}
                      className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                        (selectedEta[job.id] || 30) === min
                          ? 'bg-brand-600 border-brand-500 text-white'
                          : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300'
                      }`}>
                      {min} MIN
                    </button>
                  ))}
                </div>

                <button onClick={() => claimJob(job.id)} disabled={claiming === job.id}
                  className="w-full py-4 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black rounded-4xl text-lg transition-all active:scale-95 shadow-lg shadow-brand-900/20">
                  {claiming === job.id ? 'CLAIMING...' : `CLAIM — ${selectedEta[job.id] || 30} MIN ETA`}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

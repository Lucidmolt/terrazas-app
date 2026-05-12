'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface JobData {
  id: string;
  status: string;
  serviceType: string;
  tier: string;
  zipCode: string;
  address: string;
  price: number;
  aiWarning: boolean;
  conditionNotes: string | null;
}

export default function ClaimPage() {
  const params = useParams();
  const jobId = params.token as string;

  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [selectedEta, setSelectedEta] = useState(30);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await fetch(`/api/jobs?status=broadcast`);
        const data = await res.json();
        const found = data.jobs?.find((j: any) => j.id === jobId);
        setJob(found || null);
      } catch { setJob(null); }
      setLoading(false);
    };
    if (jobId) fetchJob();
  }, [jobId]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await fetch('/api/jobs/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, providerId: 'demo-provider', etaMinutes: selectedEta }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Claim failed' });
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (!job) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-center p-6">
      <div className="space-y-4"><div className="text-6xl">❌</div><h1 className="text-2xl font-black">Job Not Found</h1><p className="text-slate-400">This job may have been cancelled or already claimed.</p><a href="/pro" className="btn-brand inline-block w-auto px-8">Go to Dashboard</a></div>
    </div>
  );

  if (result) return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${result.success ? 'bg-brand-600' : 'bg-red-600'}`}>
      <div className="text-center text-white space-y-6 animate-scale-in">
        <div className="text-7xl">{result.success ? '✅' : '😔'}</div>
        <h1 className="text-3xl font-black">{result.success ? 'ETA Sent!' : 'Not Available'}</h1>
        <p className="text-white/80 text-lg font-medium max-w-sm">{result.message}</p>
        <a href="/pro" className="inline-block bg-white text-slate-900 px-8 py-4 rounded-4xl font-black shadow-xl">Go to Dashboard</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-black tracking-tighter text-brand-400">TERRAZAS</h1>
        <p className="text-micro text-slate-500 mt-1">Claim This Job</p>
      </header>
      <div className="flex-1 p-6 space-y-6">
        <div className="bg-slate-800 rounded-5xl p-6 border border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold capitalize">{job.serviceType?.replace('_', ' ')} — {job.tier}</h2>
              <p className="text-slate-400 text-sm mt-1">📍 {job.address || job.zipCode}</p>
            </div>
            <p className="text-3xl font-black text-brand-400">${job.price}</p>
          </div>
          {job.aiWarning && <div className="p-3 bg-red-900/30 border border-red-700 rounded-xl mb-4"><p className="text-xs font-bold text-red-400">⚠️ AI scan suggests this yard may require extra effort.</p></div>}
          {job.conditionNotes && <p className="text-sm text-slate-400 italic">Notes: {job.conditionNotes}</p>}
        </div>
        <div className="space-y-3">
          <p className="text-label">How fast can you get there?</p>
          <div className="grid grid-cols-3 gap-3">
            {[15, 30, 45].map((min) => (
              <button key={min} onClick={() => setSelectedEta(min)}
                className={`py-4 rounded-4xl text-lg font-black border-2 transition-all ${selectedEta === min ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-900/30' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'}`}>
                {min} MIN
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-6 safe-bottom">
        <button onClick={handleClaim} disabled={claiming || job.status !== 'broadcast'}
          className="w-full py-5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black rounded-4xl text-xl transition-all active:scale-95 shadow-2xl shadow-brand-900/30">
          {claiming ? 'CLAIMING...' : job.status !== 'broadcast' ? 'JOB NO LONGER AVAILABLE' : `CLAIM — ${selectedEta} MIN ETA`}
        </button>
      </div>
    </div>
  );
}

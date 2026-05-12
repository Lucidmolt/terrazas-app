import React from 'react';

// ── Types ──────────────────────────────────────────────────────────
interface JobItem {
  id: string;
  type: string;
  address: string;
  distance: number;
  pay: number;
}

interface LiveDispatchProps {
  jobs: JobItem[];
  onClaim: (jobId: string, etaMinutes: number) => void;
}

interface ActiveJobProps {
  job: { type: string; address: string };
  step: number;
}

interface JobStatusProps {
  status: 'pending_confirmation' | 'en-route' | 'in_progress' | 'completed';
  proName: string;
  eta: number;
  onConfirm: (approved: boolean) => void;
}

/**
 * 1. THE LIVE DISPATCH SCREEN (Pro)
 * Optimized for high-glanceability in a truck.
 */
export const LiveDispatch: React.FC<LiveDispatchProps> = ({ jobs, onClaim }) => (
  <div className="bg-slate-900 min-h-screen p-4 text-white font-sans">
    <header className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-black tracking-tighter">LIVE FEED</h1>
      <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
        ● {jobs.length} JOBS NEARBY
      </div>
    </header>

    <div className="space-y-4">
      {jobs.map(job => (
        <div key={job.id} className="bg-slate-800 rounded-3xl p-6 border border-slate-700 shadow-2xl">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-700 px-2 py-1 rounded">
                {job.distance} Miles Away
              </span>
              <h2 className="text-xl font-bold mt-2">{job.type}</h2>
              <p className="text-slate-400 text-sm">{job.address}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-emerald-400">${job.pay}</p>
              <p className="text-[10px] text-slate-500 font-bold">EST. 45 MIN</p>
            </div>
          </div>
          
          {/* ETA Selection */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[15, 30, 45].map(min => (
              <button 
                key={min}
                onClick={() => onClaim(job.id, min)}
                className="py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold border border-slate-600"
              >
                {min} MIN
              </button>
            ))}
          </div>

          <button className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl text-lg transition-all active:scale-95 shadow-lg shadow-emerald-900/20">
            CLAIM WITH ETA
          </button>
        </div>
      ))}
    </div>
  </div>
);

/**
 * 2. THE ACTIVE JOB SCREEN (Pro)
 */
export const ActiveJob: React.FC<ActiveJobProps> = ({ job, step }) => (
  <div className="bg-white min-h-screen flex flex-col font-sans">
    <div className="p-6 border-b">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-bold">Active: {job.type}</h1>
        <button className="text-slate-400">⚠️ Report</button>
      </div>
      <p className="text-slate-500">{job.address}</p>
    </div>

    <div className="flex-1 p-6 space-y-8">
      <div className="flex justify-between">
        {['Arrival', 'Before', 'Work', 'After'].map((s, i) => (
          <div key={s} className="flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i <= step ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              {i + 1}
            </div>
            <span className="text-[10px] font-bold text-slate-400">{s}</span>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 h-64 flex flex-col items-center justify-center text-slate-400">
        <span className="text-4xl mb-2">📸</span>
        <p className="font-bold">Tap to Take {step === 1 ? 'Before' : 'After'} Photo</p>
      </div>
    </div>

    <div className="p-6 bg-slate-50 border-t">
      <button className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl text-xl shadow-xl active:scale-95">
        {step === 0 ? 'CONFIRM ARRIVAL' : step === 3 ? 'COMPLETE JOB' : 'NEXT STEP'}
      </button>
    </div>
  </div>
);

/**
 * 3. THE JOB STATUS SCREEN (Customer)
 */
export const JobStatus: React.FC<JobStatusProps> = ({ status, proName, eta, onConfirm }) => (
  <div className="bg-emerald-500 min-h-screen p-6 font-sans flex flex-col">
    <div className="flex-1 flex flex-col items-center justify-center text-center text-white">
      <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center text-5xl mb-6 backdrop-blur-md">
        {status === 'pending_confirmation' ? '⏳' : status === 'en-route' ? '🚜' : '✂️'}
      </div>
      <h1 className="text-3xl font-black mb-2">
        {status === 'pending_confirmation' ? 'Pro Found!' : status === 'en-route' ? 'Pro is En Route!' : 'Mowing in Progress'}
      </h1>
      <p className="opacity-80 text-lg">
        {status === 'pending_confirmation' ? `${proName} is ready to help.` : `${proName} is on the way.`}
      </p>
    </div>

    {status === 'pending_confirmation' && (
      <div className="bg-white rounded-3xl p-8 shadow-2xl">
        <h2 className="text-slate-900 text-xl font-bold text-center mb-2">{proName} found!</h2>
        <p className="text-slate-500 text-center mb-6">They can be there in <span className="text-emerald-600 font-bold">{eta} mins</span>. Does that work?</p>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => onConfirm(true)} className="py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100">YES, PERFECT</button>
          <button onClick={() => onConfirm(false)} className="py-4 bg-slate-100 text-slate-400 font-bold rounded-2xl">NO, TOO LATE</button>
        </div>
      </div>
    )}

    {status === 'completed' && (
      <div className="bg-white rounded-3xl p-8 shadow-2xl">
        <h2 className="text-slate-900 text-xl font-bold text-center mb-6">Rate {proName}</h2>
        <button className="w-full py-4 bg-emerald-500 text-white font-bold rounded-2xl">Leave Review & Tip</button>
      </div>
    )}
  </div>
);

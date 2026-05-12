'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ScanResult {
  conditionScore: number;
  estimatedEffort: string;
  findings: string[];
  recommendation: string;
  priceAdjustment: number;
  warning: boolean;
}

export default function YardVisionPage() {
  const [image, setImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [aiStatus, setAIStatus] = useState<{ available: boolean; provider: string; model: string } | null>(null);
  const [error, setError] = useState('');
  const cameraRef = useRef<HTMLInputElement>(null);

  // Check AI health on mount
  useEffect(() => {
    fetch('/api/yard-vision')
      .then((r) => r.json())
      .then(setAIStatus)
      .catch(() => setAIStatus({ available: false, provider: 'unknown', model: 'unknown' }));
  }, []);

  // Handle image from either source
  const processImage = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, etc.)');
      return;
    }

    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreview(dataUrl);
      setImage(dataUrl.split(',')[1]);
      setResult(null);
      setError('');

    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  // Run AI scan
  const runScan = async () => {
    if (!image) return;
    setScanning(true);
    setError('');
    try {
      const res = await fetch('/api/yard-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, mimeType: 'image/jpeg' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.scan);
    } catch (err: any) {
      setError(err.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 7) return 'text-brand-600';
    if (score >= 4) return 'text-amber-600';
    return 'text-red-600';
  };

  const getEffortBadge = (effort: string) => {
    const styles: Record<string, string> = {
      low: 'bg-brand-50 text-brand-700',
      medium: 'bg-amber-50 text-amber-700',
      high: 'bg-orange-50 text-orange-700',
      extreme: 'bg-red-50 text-red-700',
    };
    return styles[effort] || styles.medium;
  };

  const resetScan = () => {
    setResult(null);
    setPreview(null);
    setImage(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-slate-100 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <a href="/" className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-bold">←</a>
          <div>
            <h1 className="text-xl font-black tracking-tight">Yard Vision AI</h1>
            <p className="text-micro text-slate-400">Instant condition analysis</p>
          </div>
        </div>
        {aiStatus && (
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold ${
            aiStatus.available ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-600'
          }`}>
            <div className={`w-2 h-2 rounded-full ${aiStatus.available ? 'bg-brand-500' : 'bg-red-500'}`} />
            <span>{aiStatus.available ? `${aiStatus.provider === 'lmstudio' ? 'LM Studio' : aiStatus.provider === 'ollama' ? 'Local' : 'Cloud'} AI Ready` : 'AI Offline'}</span>
          </div>
        )}
      </header>

      <div className="max-w-lg mx-auto p-6 space-y-6">

        {/* ── Source Picker / Upload Area ──────────────────────────── */}
        {!preview && (
          <div className="space-y-3 animate-fade-in">
            {/* Camera Button — Real-time photos only */}
            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full relative rounded-5xl border-2 border-brand-500 bg-brand-600 text-white cursor-pointer transition-all overflow-hidden active:scale-[0.98] shadow-xl shadow-brand-200"
              style={{ minHeight: '240px' }}
            >
              <div className="flex flex-col items-center justify-center h-[240px] space-y-4">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-black text-xl">Take Photo of Your Yard</p>
                  <p className="text-white/70 text-xs font-bold mt-1">Real-time photos only — ensures accurate pricing</p>
                </div>
              </div>
            </button>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
              <p className="text-[10px] font-bold text-slate-400">📸 Photos must be taken live to ensure accurate yard conditions</p>
            </div>
          </div>
        )}

        {/* Hidden camera input — real-time capture only */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* ── Preview ─────────────────────────────────────────────── */}
        {preview && (
          <div className="animate-scale-in">
            <div className="relative rounded-5xl overflow-hidden border-2 border-brand-500 bg-brand-50/30 shadow-xl">
              <img src={preview} alt="Yard photo" className="w-full h-80 object-cover" />

              {/* Retake/Replace buttons overlaid on image */}
              {!scanning && !result && (
                <div className="absolute top-3 right-3 flex space-x-2">
                  <button onClick={() => cameraRef.current?.click()}
                    className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded-xl text-xs font-bold text-slate-700 shadow-lg flex items-center space-x-1.5 hover:bg-white transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Retake</span>
                  </button>
                  <button onClick={resetScan}
                    className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded-xl text-xs font-bold text-red-600 shadow-lg hover:bg-white transition-all">
                    ✕
                  </button>
                </div>
              )}

              {/* Scan animation overlay */}
              {scanning && (
                <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center">
                  <div className="scan-line absolute inset-x-0 h-1 top-0" />
                  <div className="text-4xl mb-4">🔍</div>
                  <div className="text-white font-black text-lg">Analyzing...</div>
                  <div className="text-white/60 text-micro mt-1">
                    {aiStatus?.provider === 'lmstudio' ? 'LM Studio processing'
                      : aiStatus?.provider === 'ollama' ? 'Local AI model'
                      : 'Cloud vision processing'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scan Button */}
        {preview && !result && (
          <button onClick={runScan} disabled={scanning || !aiStatus?.available}
            className="btn-brand animate-fade-in">
            {scanning ? 'Scanning...' : aiStatus?.available ? '🔬 Analyze Yard Condition' : 'AI Not Available — Start LM Studio Server'}
          </button>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-4xl animate-fade-in">
            <p className="text-sm font-bold text-red-600">{error}</p>
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────── */}
        {result && (
          <div className="space-y-4 animate-scale-in">
            {/* Score Card */}
            <div className="bg-white rounded-5xl p-6 shadow-xl border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-label">Condition Score</p>
                  <p className={`text-5xl font-black ${getScoreColor(result.conditionScore)}`}>
                    {result.conditionScore}<span className="text-xl text-slate-300">/10</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className={`badge ${getEffortBadge(result.estimatedEffort)}`}>
                    {result.estimatedEffort} effort
                  </span>
                  {result.warning && (
                    <div className="mt-2 badge badge-live">⚠️ Warning</div>
                  )}
                </div>
              </div>

              <p className="text-sm font-medium text-slate-600 italic border-t border-slate-50 pt-4">
                "{result.recommendation}"
              </p>

              {result.priceAdjustment > 0 && (
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-xs font-bold text-amber-800">
                    💰 Suggested price adjustment: +${result.priceAdjustment}
                  </p>
                </div>
              )}
            </div>

            {/* Findings */}
            {result.findings.length > 0 && (
              <div className="bg-white rounded-5xl p-6 shadow-lg border border-slate-100">
                <h3 className="text-label mb-3">Detected Issues</h3>
                <div className="space-y-2">
                  {result.findings.map((finding, i) => (
                    <div key={i} className="flex items-start space-x-3 p-3 bg-slate-50 rounded-xl">
                      <span className="text-amber-500 mt-0.5">⚠</span>
                      <span className="text-sm font-medium text-slate-700">{finding}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-3">
              <button onClick={resetScan}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-4xl hover:bg-slate-200 transition-all">
                Scan Another
              </button>
              <a href={`/?zip=&scan=${result.conditionScore}`}
                className="flex-1 py-4 bg-brand-600 text-white font-bold rounded-4xl text-center shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all">
                Book Service
              </a>
            </div>
          </div>
        )}

        {/* ── How It Works ────────────────────────────────────────── */}
        <div className="p-5 bg-brand-50/50 rounded-5xl border border-brand-100/50">
          <h3 className="text-xs font-black text-brand-800 uppercase tracking-widest mb-2">How It Works</h3>
          <ol className="text-[11px] font-bold text-brand-700 leading-relaxed space-y-1">
            <li>1. 📸 Take a photo or upload from your gallery</li>
            <li>2. 🤖 AI analyzes grass height, debris, and condition</li>
            <li>3. 📊 Get an instant assessment and price estimate</li>
            <li>4. ✅ Book with confidence — no surprises for your pro</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

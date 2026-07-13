'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { TIP_PRESETS } from '@/lib/constants';
import { BUSINESS } from '@/lib/business';

function ReviewContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId') || '';
  // Identity comes from the session server-side; the API derives the
  // provider from the job record.
  const proName = searchParams.get('proName') || BUSINESS.shortName;

  const [step, setStep] = useState<'review' | 'tip' | 'done'>('review');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [tipAmount, setTipAmount] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Submit Review ────────────────────────────────────────────────
  const submitReview = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          rating,
          comment: comment || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      setStep('tip');
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  // ── Submit Tip ───────────────────────────────────────────────────
  const submitTip = async () => {
    const amount = tipAmount || parseFloat(customTip);
    if (!amount || amount < 1) {
      setStep('done');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Failed to process tip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        {/* ── Step: Review ──────────────────────────────────────────── */}
        {step === 'review' && (
          <div className="bg-white rounded-5xl p-8 shadow-2xl space-y-6 animate-scale-in">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 bg-brand-50 rounded-full mx-auto flex items-center justify-center text-4xl">⭐</div>
              <h1 className="text-2xl font-black tracking-tight">Rate {proName}</h1>
              <p className="text-slate-500 text-sm font-medium">How was the service?</p>
            </div>

            {/* Star Rating */}
            <div className="flex justify-center space-x-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)}
                  className={`w-12 h-12 rounded-2xl text-2xl transition-all ${
                    star <= rating
                      ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-200 scale-110'
                      : 'bg-slate-50 text-slate-300 hover:bg-yellow-50'
                  }`}>
                  ★
                </button>
              ))}
            </div>
            <div className="text-center text-sm font-bold text-slate-400">
              {['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing!'][rating]}
            </div>

            {/* Comment */}
            <textarea value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us about your experience (optional)"
              rows={3}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-4 text-sm font-medium placeholder:text-slate-300 focus:border-brand-500 focus:outline-none resize-none transition-all"
            />

            {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}

            <button onClick={submitReview} disabled={loading}
              className="btn-brand">
              {loading ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        )}

        {/* ── Step: Tip ────────────────────────────────────────────── */}
        {step === 'tip' && (
          <div className="bg-white rounded-5xl p-8 shadow-2xl space-y-6 animate-scale-in">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 bg-brand-600 rounded-full mx-auto flex items-center justify-center text-4xl text-white">💚</div>
              <h1 className="text-2xl font-black tracking-tight">Leave a Tip?</h1>
              <p className="text-slate-500 text-sm font-medium">100% goes directly to {proName}.</p>
            </div>

            {/* Preset Amounts */}
            <div className="grid grid-cols-5 gap-2">
              {TIP_PRESETS.map((amount) => (
                <button key={amount} onClick={() => { setTipAmount(amount); setCustomTip(''); }}
                  className={`py-4 rounded-2xl text-lg font-black border-2 transition-all ${
                    tipAmount === amount
                      ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-200'
                      : 'bg-white border-slate-100 text-slate-600 hover:border-brand-300'
                  }`}>
                  ${amount}
                </button>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">$</span>
              <input type="number" min="1" max="500" value={customTip}
                onChange={(e) => { setCustomTip(e.target.value); setTipAmount(null); }}
                placeholder="Custom amount"
                className="w-full pl-10 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-4xl font-bold text-lg placeholder:text-slate-300 focus:border-brand-500 focus:outline-none transition-all"
              />
            </div>

            {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}

            <div className="space-y-3">
              <button onClick={submitTip} disabled={loading}
                className="btn-brand">
                {loading ? 'Processing...' :
                  (tipAmount || parseFloat(customTip) > 0)
                    ? `Send $${tipAmount || customTip} Tip`
                    : 'Skip Tip'}
              </button>
              <button onClick={() => setStep('done')}
                className="w-full text-slate-400 font-bold text-sm py-2 hover:text-slate-600 transition-colors">
                No tip this time
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Done ───────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="text-center space-y-8 animate-scale-in">
            <div className="relative w-32 h-32 mx-auto">
              <div className="absolute inset-0 bg-brand-500/20 rounded-full animate-ping" />
              <div className="relative w-full h-full bg-brand-600 rounded-full flex items-center justify-center text-6xl text-white shadow-xl">🎉</div>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tighter text-slate-900">Thank You!</h1>
              <p className="text-slate-500 font-medium">Your feedback helps the Terrazas community.</p>
            </div>
            <a href="/" className="btn-primary inline-block text-center w-full max-w-xs mx-auto">
              Back to Home
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ReviewContent />
    </Suspense>
  );
}

'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { JOB_STATUS_LABELS } from '@/lib/constants';

interface JobItem {
  id: string; status: string; serviceType: string; tier: string; zipCode: string;
  address: string; price: number; providerPayout: number; customerTotal: number;
  aiWarning: boolean; conditionNotes: string | null; createdAt: string;
  completedAt?: string; cancelledAt?: string;
  customer?: { name: string | null };
  review?: { rating: number; comment: string | null } | null;
  tip?: { amount: number; status: string } | null;
}

interface ProviderInfo {
  id: string; proTier: number; upgradeEligible: boolean; completedJobCount: number;
  rating: number; escrowBalance: number; maxActiveJobs: number; equipmentTag: string | null;
  businessName: string; phone: string | null; bio: string | null; email: string | null;
  zipCodes: string; equipmentType: string | null; teamSize: string | null;
  serviceRadiusMi: number; reviewCount: number;
  user?: { name: string | null; email: string | null };
  userId?: string | null;
}

interface ProviderStats {
  completedJobs: number; cancelledJobs: number;
  thisMonthEarnings: number; thisMonthJobs: number;
  monthlyEarnings: { month: string; revenue: number; jobs: number }[];
}

interface PayoutInfo {
  pendingBalance: number; availableBalance: number; escrowHeld: number;
  nextPayoutDate: string; holdDays: number; canInstant: boolean;
  instantFee: number; freeInstant: boolean; recentPayouts: any[]; lifetimeEarnings: number;
}

export default function ProDashboard() {
  const [tab, setTab] = useState<'feed' | 'myjobs' | 'earnings' | 'history' | 'profile'>('feed');
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
  const [providerStats, setProviderStats] = useState<ProviderStats | null>(null);
  const [historyJobs, setHistoryJobs] = useState<JobItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({ businessName: '', phone: '', bio: '', zipCodes: '', equipmentType: '', teamSize: '', name: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Notifications state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);

  // New features state
  const [activeChatJobId, setActiveChatJobId] = useState<string | null>(null);
  const [announceZipCode, setAnnounceZipCode] = useState('');
  const [announceHours, setAnnounceHours] = useState('2');
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [announcementLoading, setAnnouncementLoading] = useState(false);

  // Geolocation watch telemetry for active jobs that are en_route
  useEffect(() => {
    let watchId: number | null = null;
    const enRouteJobs = myJobs.filter(j => j.status === 'en_route');

    if (enRouteJobs.length > 0) {
      const activeJob = enRouteJobs[0];
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        let lastPostTime = 0;
        
        watchId = navigator.geolocation.watchPosition(
          async (position) => {
            const now = Date.now();
            // Throttle reports to every 30 seconds
            if (now - lastPostTime >= 30000) {
              lastPostTime = now;
              const { latitude, longitude } = position.coords;
              try {
                await fetch('/api/provider/location', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jobId: activeJob.id,
                    lat: latitude,
                    lng: longitude,
                  }),
                });
              } catch (err) {
                console.error('Failed to report telemetry location:', err);
              }
            }
          },
          (err) => {
            console.error('Telemetry watch error:', err);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000,
          }
        );
      }
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [myJobs]);

  const submitAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announceZipCode.trim() || announcementLoading) return;
    setAnnouncementLoading(true);
    setAnnouncementMsg('');
    try {
      const res = await fetch('/api/provider/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipCode: announceZipCode, hours: announceHours }),
      });
      const data = await res.json();
      if (res.ok) {
        setAnnouncementMsg(`✅ Broadcast active in ${announceZipCode} for ${announceHours} hours!`);
        setAnnounceZipCode('');
      } else {
        setAnnouncementMsg(`❌ ${data.error || 'Failed to announce availability'}`);
      }
    } catch {
      setAnnouncementMsg('❌ Failed to announce availability');
    } finally {
      setAnnouncementLoading(false);
    }
  };

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
      if (pRes.ok) {
        const pData = await pRes.json();
        setProviderInfo(pData.provider || null);
        if (pData.stats) setProviderStats(pData.stats);
      }
    } catch {} finally { setLoading(false); }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      if (res.ok) {
        await fetchNotifications();
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    if (notif.jobId) {
      const isInMyJobs = myJobs.some(j => j.id === notif.jobId);
      const targetTab = isInMyJobs ? 'myjobs' : 'feed';
      setTab(targetTab);
      setHighlightedJobId(notif.jobId);
      setShowNotifications(false);
      setTimeout(() => {
        const el = document.getElementById(`job-${notif.jobId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      setTimeout(() => {
        setHighlightedJobId(prev => prev === notif.jobId ? null : prev);
      }, 4000);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchNotifications();
    const i = setInterval(fetchJobs, 10000);
    const ni = setInterval(fetchNotifications, 20000);
    return () => {
      clearInterval(i);
      clearInterval(ni);
    };
  }, []);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Bell Icon & Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: showNotifications ? '#34d399' : '#94a3b8',
                  borderRadius: '8px',
                  background: showNotifications ? 'rgba(52, 211, 153, 0.1)' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '9px',
                    fontWeight: 900,
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #0f172a'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div style={{
                  position: 'absolute',
                  top: '40px',
                  right: '0',
                  width: '300px',
                  background: 'rgba(30, 41, 59, 0.95)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid #334155',
                  borderRadius: '16px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3)',
                  zIndex: 50,
                  maxHeight: '360px',
                  overflowY: 'auto',
                  padding: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #334155' }}>
                    <span style={{ fontWeight: 800, fontSize: '13px', color: '#fff' }}>Notifications</span>
                    {unreadCount > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '2px 8px', borderRadius: '10px' }}>{unreadCount} New</span>}
                  </div>
                  {notifications.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#64748b', fontSize: '12px', margin: '20px 0' }}>No notifications yet</p>
                  ) : notifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        background: notif.isRead ? 'transparent' : 'rgba(52, 211, 153, 0.1)',
                        marginBottom: '6px',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        border: '1px solid',
                        borderColor: notif.isRead ? 'transparent' : 'rgba(52, 211, 153, 0.2)',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '12px', color: '#fff' }}>{notif.title}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', lineHeight: '1.4' }}>{notif.body}</div>
                      <div style={{ fontSize: '9px', color: '#64748b', marginTop: '6px' }}>{new Date(notif.createdAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {(['feed', 'myjobs', 'history', 'earnings', 'profile'] as const).map(t => {
                const labels = { feed: `📡 ${jobs.length}`, myjobs: `🔧 ${myJobs.length}`, history: '📋', earnings: '💰', profile: '👤' };
                return (
                  <button key={t} onClick={async () => {
                    setTab(t);
                    if (t === 'earnings' && providerInfo?.id) {
                      const res = await fetch(`/api/provider/payout?providerId=${providerInfo.id}`);
                      if (res.ok) { const d = await res.json(); setPayoutInfo(d.payout); }
                    }
                    if (t === 'history' && historyJobs.length === 0) {
                      const s = historyFilter === 'all' ? 'completed,cancelled' : historyFilter;
                      const res = await fetch(`/api/provider/history?status=${s}&page=1`);
                      if (res.ok) { const d = await res.json(); setHistoryJobs(d.jobs); setHistoryTotal(d.pagination.total); }
                    }
                    if (t === 'profile' && providerInfo) {
                      setProfileForm({
                        businessName: providerInfo.businessName || '',
                        phone: providerInfo.phone || '',
                        bio: providerInfo.bio || '',
                        zipCodes: (() => { try { return JSON.parse(providerInfo.zipCodes).join(', '); } catch { return providerInfo.zipCodes; } })(),
                        equipmentType: providerInfo.equipmentType || 'residential',
                        teamSize: providerInfo.teamSize || 'solo',
                        name: providerInfo.user?.name || '',
                      });
                    }
                  }} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: tab === t ? '#059669' : '#1e293b', color: tab === t ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                    {labels[t]}
                  </button>
                );
              })}
            </div>
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
            const isHighlighted = highlightedJobId === job.id;
            return (
              <div
                key={job.id}
                id={`job-${job.id}`}
                style={{
                  background: '#1e293b',
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 12,
                  border: isHighlighted ? '2px solid #34d399' : '1px solid #334155',
                  boxShadow: isHighlighted ? '0 0 15px rgba(52, 211, 153, 0.3)' : 'none',
                  transition: 'all 0.3s ease-in-out'
                }}
              >
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
            const isHighlighted = highlightedJobId === job.id;
            return (
              <div
                key={job.id}
                id={`job-${job.id}`}
                style={{
                  background: '#1e293b',
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 12,
                  border: isHighlighted ? '2px solid #34d399' : '1px solid #334155',
                  boxShadow: isHighlighted ? '0 0 15px rgba(52, 211, 153, 0.3)' : 'none',
                  transition: 'all 0.3s ease-in-out'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>📍 {job.address || job.zipCode}</h3>
                    <p style={{ fontSize: 13, color: '#94a3b8' }}>{job.serviceType?.replace('_', ' ')} — {job.tier}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Customer: {job.customer?.name || 'Assigned'}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveChatJobId(job.id); }}
                        style={{ padding: '4px 10px', borderRadius: 6, background: '#1e293b', color: '#34d399', border: '1px solid #334155', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        💬 Chat
                      </button>
                    </div>
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

        {/* ── JOB HISTORY TAB ── */}
        {tab === 'history' && (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['all', 'completed', 'cancelled'] as const).map(f => (
                <button key={f} onClick={async () => {
                  setHistoryFilter(f); setHistoryPage(1);
                  const s = f === 'all' ? 'completed,cancelled' : f;
                  const res = await fetch(`/api/provider/history?status=${s}&page=1`);
                  if (res.ok) { const d = await res.json(); setHistoryJobs(d.jobs); setHistoryTotal(d.pagination.total); }
                }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: historyFilter === f ? '#059669' : '#1e293b', color: historyFilter === f ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 11, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {f} ({f === 'all' ? (providerStats?.completedJobs || 0) + (providerStats?.cancelledJobs || 0) : f === 'completed' ? providerStats?.completedJobs || 0 : providerStats?.cancelledJobs || 0})
                </button>
              ))}
            </div>

            {historyJobs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
                <div style={{ fontSize: 48 }}>📋</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>No job history yet</h2>
                <p style={{ fontSize: 13 }}>Completed jobs will appear here.</p>
              </div>
            ) : historyJobs.map(job => (
              <div key={job.id} style={{ background: '#1e293b', borderRadius: 14, padding: 16, marginBottom: 10, border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: job.status === 'completed' ? '#052e16' : '#450a0a', color: job.status === 'completed' ? '#34d399' : '#fca5a5', fontWeight: 700 }}>
                      {job.status === 'completed' ? '✓ Completed' : '✗ Cancelled'}
                    </span>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{job.serviceType?.replace('_', ' ')} — {job.tier}</h3>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>📍 {job.address || job.zipCode}</p>
                    {job.customer?.name && <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Customer: {job.customer.name}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: job.status === 'completed' ? '#34d399' : '#64748b' }}>${job.providerPayout || job.price}</div>
                    <div style={{ fontSize: 10, color: '#475569' }}>
                      {job.completedAt ? new Date(job.completedAt).toLocaleDateString() : job.cancelledAt ? new Date(job.cancelledAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                </div>
                {job.review && (
                  <div style={{ background: '#0f172a', borderRadius: 10, padding: 10, marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>{'★'.repeat(job.review.rating)}{'☆'.repeat(5 - job.review.rating)}</div>
                    {job.review.comment && <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>&ldquo;{job.review.comment}&rdquo;</p>}
                  </div>
                )}
                {job.tip && job.tip.status === 'completed' && (
                  <div style={{ fontSize: 11, color: '#34d399', marginTop: 6, fontWeight: 600 }}>💚 Tip: ${job.tip.amount.toFixed(2)}</div>
                )}
              </div>
            ))}

            {historyTotal > 20 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
                <button disabled={historyPage <= 1} onClick={async () => {
                  const p = historyPage - 1; setHistoryPage(p);
                  const s = historyFilter === 'all' ? 'completed,cancelled' : historyFilter;
                  const res = await fetch(`/api/provider/history?status=${s}&page=${p}`);
                  if (res.ok) { const d = await res.json(); setHistoryJobs(d.jobs); }
                }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                  ← Prev
                </button>
                <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center' }}>Page {historyPage}</span>
                <button disabled={historyPage * 20 >= historyTotal} onClick={async () => {
                  const p = historyPage + 1; setHistoryPage(p);
                  const s = historyFilter === 'all' ? 'completed,cancelled' : historyFilter;
                  const res = await fetch(`/api/provider/history?status=${s}&page=${p}`);
                  if (res.ok) { const d = await res.json(); setHistoryJobs(d.jobs); }
                }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                  Next →
                </button>
              </div>
            )}

            {/* Analytics Section within History */}
            {providerStats && providerStats.monthlyEarnings.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#94a3b8', marginBottom: 12 }}>📊 Revenue Trend</h3>
                <div style={{ background: '#1e293b', borderRadius: 14, padding: 16, border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                    {(() => {
                      const max = Math.max(...providerStats.monthlyEarnings.map(m => m.revenue), 1);
                      return providerStats.monthlyEarnings.map(m => (
                        <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#34d399' }}>${Math.round(m.revenue)}</div>
                          <div style={{ width: '100%', background: 'linear-gradient(to top, #059669, #34d399)', borderRadius: 4, height: `${Math.max((m.revenue / max) * 80, 4)}px`, transition: 'height 0.5s' }} />
                          <div style={{ fontSize: 9, color: '#64748b' }}>{new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short' })}</div>
                          <div style={{ fontSize: 8, color: '#475569' }}>{m.jobs} jobs</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Summary Stats */}
            {providerStats && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
                <div style={{ background: '#1e293b', borderRadius: 12, padding: 14, border: '1px solid #334155', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#34d399' }}>{providerStats.completedJobs}</div>
                  <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>COMPLETED</div>
                </div>
                <div style={{ background: '#1e293b', borderRadius: 12, padding: 14, border: '1px solid #334155', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#fbbf24' }}>${Math.round(providerStats.thisMonthEarnings)}</div>
                  <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>THIS MONTH</div>
                </div>
                <div style={{ background: '#1e293b', borderRadius: 12, padding: 14, border: '1px solid #334155', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#94a3b8' }}>{providerStats.thisMonthJobs}</div>
                  <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>JOBS/MO</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && providerInfo && (
          <div>
            {/* Announce Availability Panel */}
            <div style={{ background: '#1e293b', borderRadius: 16, padding: 24, border: '1px solid #334155', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, marginBottom: 6, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                ⚡ Announce Nearby Availability
              </h3>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, marginBottom: 16 }}>
                Announce you are active in a specific zip code right now so local customers can route jobs to you instantly.
              </p>

              {announcementMsg && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  background: announcementMsg.startsWith('✅') ? '#052e16' : '#450a0a',
                  color: announcementMsg.startsWith('✅') ? '#34d399' : '#fca5a5',
                  marginBottom: '14px',
                  border: announcementMsg.startsWith('✅') ? '1px solid #065f46' : '1px solid #991b1b',
                }}>
                  {announcementMsg}
                </div>
              )}

              <form onSubmit={submitAnnouncement} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zip Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 67901"
                    value={announceZipCode}
                    onChange={(e) => setAnnounceZipCode(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', marginTop: 4, borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</label>
                  <select
                    value={announceHours}
                    onChange={(e) => setAnnounceHours(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', marginTop: 4, borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: 14 }}
                  >
                    <option value="1">1 hour</option>
                    <option value="2">2 hours</option>
                    <option value="4">4 hours</option>
                    <option value="8">8 hours</option>
                    <option value="12">12 hours</option>
                    <option value="24">24 hours</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={announcementLoading || !announceZipCode.trim()}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    opacity: announcementLoading || !announceZipCode.trim() ? 0.6 : 1,
                  }}
                >
                  {announcementLoading ? 'Announcing...' : 'Broadcast'}
                </button>
              </form>
            </div>

            <div style={{ background: '#1e293b', borderRadius: 16, padding: 24, border: '1px solid #334155', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>👤 Business Profile</h3>
                {!profileEditing ? (
                  <button onClick={() => setProfileEditing(true)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>✏️ Edit</button>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setProfileEditing(false); setProfileMsg(''); }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    <button disabled={profileSaving} onClick={async () => {
                      setProfileSaving(true); setProfileMsg('');
                      try {
                        const res = await fetch('/api/provider/me', {
                          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ...profileForm, zipCodes: profileForm.zipCodes.split(',').map(z => z.trim()).filter(Boolean) }),
                        });
                        if (res.ok) { setProfileMsg('✅ Profile updated!'); setProfileEditing(false); fetchJobs(); }
                        else { const d = await res.json(); setProfileMsg(`❌ ${d.error}`); }
                      } catch { setProfileMsg('❌ Failed to save'); }
                      setProfileSaving(false);
                    }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: profileSaving ? 0.5 : 1 }}>
                      {profileSaving ? 'Saving...' : '💾 Save'}
                    </button>
                  </div>
                )}
              </div>

              {profileMsg && <div style={{ padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 12, background: profileMsg.startsWith('✅') ? '#052e16' : '#450a0a', color: profileMsg.startsWith('✅') ? '#34d399' : '#fca5a5' }}>{profileMsg}</div>}

              <div style={{ display: 'grid', gap: 14 }}>
                {[
                  { label: 'YOUR NAME', key: 'name', placeholder: 'John Smith' },
                  { label: 'BUSINESS NAME', key: 'businessName', placeholder: "Smith's Lawn Care" },
                  { label: 'PHONE', key: 'phone', placeholder: '(555) 123-4567' },
                  { label: 'SERVICE ZIP CODES', key: 'zipCodes', placeholder: '67401, 67402' },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{field.label}</label>
                    {profileEditing ? (
                      <input value={(profileForm as any)[field.key]} onChange={e => setProfileForm(p => ({ ...p, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        style={{ width: '100%', padding: '10px 14px', marginTop: 4, borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: 14, fontWeight: 500 }} />
                    ) : (
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginTop: 4 }}>{(profileForm as any)[field.key] || '—'}</div>
                    )}
                  </div>
                ))}

                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>BIO</label>
                  {profileEditing ? (
                    <textarea value={profileForm.bio} onChange={e => setProfileForm(p => ({ ...p, bio: e.target.value }))}
                      placeholder="Tell customers about your business..." rows={3}
                      style={{ width: '100%', padding: '10px 14px', marginTop: 4, borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: 14, fontWeight: 500, resize: 'none' as const }} />
                  ) : (
                    <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4, lineHeight: 1.6 }}>{profileForm.bio || 'No bio yet'}</div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>EQUIPMENT</label>
                    {profileEditing ? (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        {['residential', 'commercial'].map(t => (
                          <button key={t} onClick={() => setProfileForm(p => ({ ...p, equipmentType: t }))}
                            style={{ flex: 1, padding: 8, borderRadius: 8, border: profileForm.equipmentType === t ? '2px solid #059669' : '1px solid #334155', background: profileForm.equipmentType === t ? '#052e16' : '#0f172a', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' as const }}>{t}</button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginTop: 4, textTransform: 'capitalize' as const }}>{profileForm.equipmentType || '—'}</div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>TEAM SIZE</label>
                    {profileEditing ? (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        {['solo', 'small', 'medium'].map(t => (
                          <button key={t} onClick={() => setProfileForm(p => ({ ...p, teamSize: t }))}
                            style={{ flex: 1, padding: 8, borderRadius: 8, border: profileForm.teamSize === t ? '2px solid #059669' : '1px solid #334155', background: profileForm.teamSize === t ? '#052e16' : '#0f172a', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' as const }}>{t}</button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginTop: 4, textTransform: 'capitalize' as const }}>{profileForm.teamSize || '—'}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Info (read-only) */}
            <div style={{ background: '#1e293b', borderRadius: 14, padding: 16, border: '1px solid #334155' }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, marginBottom: 12, color: '#94a3b8' }}>Account Info</h4>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { label: 'Email', value: providerInfo.user?.email || providerInfo.email || '—' },
                  { label: 'Rating', value: `${providerInfo.rating.toFixed(1)}★ (${providerInfo.reviewCount} reviews)` },
                  { label: 'Tier', value: providerInfo.proTier === 0 ? 'Community Pro' : 'Verified Pro ✓' },
                  { label: 'Jobs Completed', value: String(providerInfo.completedJobCount) },
                  { label: 'Service Radius', value: `${providerInfo.serviceRadiusMi} miles` },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #0f172a' }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{item.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {activeChatJobId && providerInfo?.userId && (
        <ChatDrawer jobId={activeChatJobId} onClose={() => setActiveChatJobId(null)} currentUserId={providerInfo.userId} />
      )}
    </div>
  );
}

// Chat Drawer Component for Provider (Dark themed to match pro app)
function ChatDrawer({ jobId, onClose, currentUserId }: { jobId: string; onClose: () => void; currentUserId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/chat`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch chat messages:', err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    const text = inputText;
    setInputText('');

    try {
      const res = await fetch(`/api/jobs/${jobId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
      } else {
        setInputText(text);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      maxWidth: '420px',
      background: '#1e293b',
      boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid #334155',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #334155',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#0f172a',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>Customer Messages</h3>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Active Chat</span>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent',
          border: 'none',
          fontSize: 20,
          cursor: 'pointer',
          color: '#94a3b8',
          padding: 4,
        }}>✕</button>
      </div>

      <div style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading chat...</p>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', margin: 'auto 0', fontSize: 13 }}>
            <span style={{ fontSize: 32 }}>💬</span>
            <p style={{ marginTop: 8 }}>No messages yet. Send a message to start chatting!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} style={{
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '75%',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: isMe ? '16px 16px 0 16px' : '16px 16px 16px 0',
                  background: isMe ? '#059669' : '#0f172a',
                  color: '#fff',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  wordBreak: 'break-word',
                  border: isMe ? 'none' : '1px solid #334155',
                }}>
                  {msg.content}
                </div>
                <span style={{
                  fontSize: '9px',
                  color: '#64748b',
                  marginTop: '4px',
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                }}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSendMessage} style={{
        padding: '16px 20px calc(16px + env(safe-area-inset-bottom))',
        background: '#0f172a',
        borderTop: '1px solid #334155',
        display: 'flex',
        gap: '8px',
      }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type your message..."
          disabled={sending}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid #334155',
            outline: 'none',
            fontSize: '14px',
            fontFamily: 'inherit',
            background: '#1e293b',
            color: '#fff',
          }}
        />
        <button type="submit" disabled={sending || !inputText.trim()} style={{
          padding: '0 18px',
          borderRadius: '12px',
          border: 'none',
          background: '#059669',
          color: '#fff',
          fontWeight: 700,
          cursor: 'pointer',
          opacity: sending || !inputText.trim() ? 0.6 : 1,
          transition: 'all 0.2s',
        }}>
          Send
        </button>
      </form>
    </div>
  );
}

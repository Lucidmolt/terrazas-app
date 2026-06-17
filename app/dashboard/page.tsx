'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

interface Job {
  id: string; status: string; address: string; zipCode: string; scope: string;
  price: number; customerTotal: number; providerPayout: number; serviceFee: number;
  createdAt: string; claimedAt: string | null; approvedAt: string | null; completedAt: string | null;
  approvalDeadline: string | null; autoApproved: boolean; vetoCount: number;
  photoFrontUrl: string | null;
  photoBackUrl: string | null;
  photoExtraUrl: string | null;
  photoAfterUrl: string | null;
  quotedPrice: number | null;
  serviceType: string;
  tier: string;
  customerNotes: string | null;
  provider?: { id: string; businessName: string; logoUrl: string | null; rating: number; reviewCount: number; bio: string | null; portfolioPhotos: string; isVerified: boolean; };
  providerLocLat?: number | null;
  providerLocLng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  disputeStatus?: string | null;
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

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: '12px',
  border: '1px solid #cbd5e1',
  marginTop: '6px',
  marginBottom: '0px',
  fontSize: '14px',
  fontFamily: 'inherit',
  outline: 'none',
  background: '#f8fafc',
  transition: 'border-color 0.2s',
};

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'jobs' | 'profile'>('jobs');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [vetoReason, setVetoReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Profile settings state
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [profileState, setProfileState] = useState('');
  const [profileZipCode, setProfileZipCode] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Notifications state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // New features state
  const [userId, setUserId] = useState<string | null>(null);
  const [activeChatJobId, setActiveChatJobId] = useState<string | null>(null);
  const [disputingJobId, setDisputingJobId] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs?role=customer');
      if (res.ok) { const data = await res.json(); setJobs(data.jobs || []); }
    } catch {} finally { setLoading(false); }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/user/me');
      if (res.status === 401) {
        router.push('/?login=true');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUserId(data.user.id);
          setProfileName(data.user.name || '');
          setProfilePhone(data.user.phone || '');
          setProfileAddress(data.user.address || '');
          setProfileCity(data.user.city || '');
          setProfileState(data.user.state || '');
          setProfileZipCode(data.user.zipCode || '');
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setProfileLoading(false);
    }
  }, [router]);

  const fetchNotifications = useCallback(async () => {
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
  }, []);

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
      setActiveTab('jobs');
      setSelectedJob(notif.jobId);
      setShowNotifications(false);
      setTimeout(() => {
        const el = document.getElementById(`job-${notif.jobId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'profile') {
        setActiveTab('profile');
      } else {
        setActiveTab('jobs');
      }
    }
    fetchJobs();
    fetchProfile();
    fetchNotifications();
    const i = setInterval(fetchJobs, 15000);
    const ni = setInterval(fetchNotifications, 20000);
    return () => {
      clearInterval(i);
      clearInterval(ni);
    };
  }, [fetchJobs, fetchProfile, fetchNotifications]);

  const fetchAnnouncements = useCallback(async (zip: string) => {
    try {
      const res = await fetch(`/api/provider/announcements?zipCode=${zip}`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements || []);
      }
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    }
  }, []);

  useEffect(() => {
    if (profileZipCode) {
      fetchAnnouncements(profileZipCode);
    }
  }, [profileZipCode, fetchAnnouncements]);

  useEffect(() => {
    function urlBase64ToUint8Array(base64String: string) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    async function registerAndSubscribe() {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          
          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidKey) return;

          if (Notification.permission === 'default') {
            await Notification.requestPermission();
          }

          if (Notification.permission === 'granted') {
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
              });
            }

            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription }),
            });
          }
        } catch (err) {
          console.error('Push registration error:', err);
        }
      }
    }

    const timer = setTimeout(registerAndSubscribe, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleTabChange = (tab: 'jobs' | 'profile') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState({}, '', url.toString());
    }
  };

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

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const res = await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName,
          phone: profilePhone,
          address: profileAddress,
          city: profileCity,
          state: profileState,
          zipCode: profileZipCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error || 'Failed to update profile');
      } else {
        setProfileSuccess('Profile updated successfully!');
        await fetchProfile();
      }
    } catch (err: any) {
      setProfileError(err.message || 'An error occurred while saving profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  // ── Dev Tools ───────────────────────────────────────────────────
  const triggerMockClaim = async (jobId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/jobs/claim-mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      if (res.ok) {
        await fetchJobs();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to mock claim job');
      }
    } catch {
      alert('Network error during mock claim');
    } finally {
      setActionLoading(false);
    }
  };

  const triggerStatusAdvance = async (jobId: string, status: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/jobs/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status }),
      });
      if (res.ok) {
        await fetchJobs();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update job status');
      }
    } catch {
      alert('Network error during status update');
    } finally {
      setActionLoading(false);
    }
  };

  const getNextStatus = (currentStatus: string) => {
    if (currentStatus === 'active') return { status: 'en_route', label: 'Mark En Route' };
    if (currentStatus === 'en_route') return { status: 'in_progress', label: 'Mark In Progress' };
    if (currentStatus === 'in_progress') return { status: 'completed', label: 'Mark Completed' };
    return null;
  };

  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 12 };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 50%, #f0fdf4 100%)', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <a href="/" style={{ textDecoration: 'none' }}><h1 style={{ fontSize: 22, fontWeight: 900, color: '#166534', margin: 0 }}>TERRAZAS</h1></a>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Bell Icon & Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: showNotifications ? '#059669' : '#64748b'
                }}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
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
                    border: '2px solid #fff'
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
                  background: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '16px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                  zIndex: 50,
                  maxHeight: '360px',
                  overflowY: 'auto',
                  padding: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>Notifications</span>
                    {unreadCount > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '2px 8px', borderRadius: '10px' }}>{unreadCount} New</span>}
                  </div>
                  {notifications.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', margin: '20px 0' }}>No notifications yet</p>
                  ) : notifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        background: notif.isRead ? 'transparent' : '#f0fdf4',
                        marginBottom: '6px',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        border: '1px solid',
                        borderColor: notif.isRead ? 'transparent' : '#d1fae5',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '12px', color: '#1e293b' }}>{notif.title}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: '1.4' }}>{notif.body}</div>
                      <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '6px' }}>{new Date(notif.createdAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <a href="/post" style={{ padding: '8px 16px', borderRadius: 8, background: '#059669', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>+ New Job</a>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 140px' }}>
        
        {/* JOBS TAB */}
        {activeTab === 'jobs' && (
          <div style={{ animation: 'fade-in 0.4s ease-out' }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>My Jobs</h2>

            {/* Neighborhood Announcements Banner */}
            {announcements.length > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                border: '1px solid #7dd3fc',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '20px',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>⚡</span>
                  <span style={{ fontWeight: 800, color: '#0369a1', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pros Nearby!</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {announcements.map((ann) => (
                    <div key={ann.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.7)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.5)' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#0c4a6e' }}>{ann.provider.businessName}</div>
                        <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '2px' }}>
                          Active in {ann.zipCode} · {'★'.repeat(Math.round(ann.provider.rating))} {ann.provider.rating.toFixed(1)}
                        </div>
                      </div>
                      <a href={`/post?providerId=${ann.provider.id}`} style={{ padding: '6px 12px', background: '#0284c7', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: 700, transition: 'all 0.2s' }}>
                        Book Now
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              const nextStatus = getNextStatus(job.status);
              const cardStyle = {
                ...card,
                border: isSelected ? '2px solid #059669' : '1px solid #e2e8f0',
                boxShadow: isSelected ? '0 10px 15px -3px rgba(5, 150, 105, 0.1), 0 4px 6px -2px rgba(5, 150, 105, 0.05)' : '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.2s ease-in-out'
              };

              return (
                <div key={job.id} id={`job-${job.id}`} style={cardStyle} onClick={() => setSelectedJob(isSelected ? null : job.id)}>
                  {/* Status badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ padding: '4px 10px', borderRadius: 6, background: status.bg, color: status.text, fontSize: 12, fontWeight: 700 }}>{status.label}</span>
                    <div style={{ textAlign: 'right' }}>
                      {job.quotedPrice && job.quotedPrice > 0 ? (
                        <div>
                          <span style={{ fontSize: 18, fontWeight: 800, color: '#d97706' }}>
                            ${(job.quotedPrice + Math.max(job.quotedPrice * 0.13, 5.0) + 2.5).toFixed(2)}
                          </span>
                          <span style={{ fontSize: 9, color: '#d97706', display: 'block', fontWeight: 700 }}>PRO QUOTE</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>${job.customerTotal.toFixed(2)}</span>
                      )}
                    </div>
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

                      {/* Custom quote details */}
                      {job.quotedPrice && job.quotedPrice > 0 && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 14px', marginBottom: 12, fontSize: 12, color: '#b45309', fontWeight: 700, textAlign: 'left' }}>
                          💰 Provider submitted a custom price quote:
                          <div style={{ fontSize: 15, marginTop: 4, color: '#b45309', fontWeight: 800 }}>
                            ${job.quotedPrice.toFixed(2)} payout (${(job.quotedPrice + Math.max(job.quotedPrice * 0.13, 5.0) + 2.5).toFixed(2)} total cost)
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 500, color: '#d97706', marginTop: 2 }}>
                            (Original estimate: ${job.price.toFixed(2)} payout / ${job.customerTotal.toFixed(2)} total)
                          </div>
                        </div>
                      )}

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

                  {/* Provider Info & Chat & Tracking */}
                  {job.provider && job.status !== 'pending_approval' && job.status !== 'broadcast' && (
                    <div style={{ marginTop: 12, padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>
                            {job.provider.logoUrl ? <img src={job.provider.logoUrl} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} /> : job.provider.businessName[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{job.provider.businessName}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>
                              {'★'.repeat(Math.round(job.provider.rating))} {job.provider.rating.toFixed(1)}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveChatJobId(job.id); }}
                          style={{ padding: '6px 12px', borderRadius: 8, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          💬 Message
                        </button>
                      </div>

                      {/* Live tracking map when en route */}
                      {job.status === 'en_route' && (
                        <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 12, paddingTop: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#312e81', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            📍 Live Tracking (On the Way)
                          </div>
                          {job.providerLocLat && job.providerLocLng && job.latitude && job.longitude ? (
                            <TrackingMap 
                              customerLat={job.latitude} 
                              customerLng={job.longitude} 
                              providerLat={job.providerLocLat} 
                              providerLng={job.providerLocLng} 
                            />
                          ) : (
                            <div style={{ padding: '20px', textAlign: 'center', background: '#f0f4ff', borderRadius: '8px', color: '#4f46e5', fontSize: '12px' }}>
                              🚗 Provider is starting their route. Real-time tracking will display here shortly.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Completed — leave review and dispute options */}
                  {job.status === 'completed' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
                      <a href={`/review?jobId=${job.id}`} style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#fef3c7', textAlign: 'center', color: '#92400e', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ⭐ Review
                      </a>
                      {(!job.disputeStatus && job.completedAt && (Date.now() - new Date(job.completedAt).getTime() < 24 * 60 * 60 * 1000)) ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDisputingJobId(job.id); }}
                          style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                        >
                          ⚠️ Dispute
                        </button>
                      ) : job.disputeStatus ? (
                        <div style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontSize: 12, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          ⚠️ {job.disputeStatus.toUpperCase().replace('_', ' ')}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Detailed view (expanded on click) */}
                  {isSelected && (
                    <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 12 }} onClick={(e) => e.stopPropagation()}>
                      {/* Before / After comparison if completed */}
                      {job.status === 'completed' && job.photoAfterUrl ? (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>✨ Before & After comparison</div>
                          <div style={{ display: 'flex', gap: 10 }}>
                            {job.photoFrontUrl && (
                              <div style={{ flex: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid #cbd5e1', height: 120 }}>
                                <img src={job.photoFrontUrl} alt="Before" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ fontSize: 9, background: '#f8fafc', padding: '3px', textAlign: 'center', fontWeight: 700, borderTop: '1px solid #cbd5e1', color: '#475569' }}>BEFORE</div>
                              </div>
                            )}
                            <div style={{ flex: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid #a7f3d0', height: 120 }}>
                              <img src={job.photoAfterUrl} alt="After" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <div style={{ fontSize: 9, background: '#ecfdf5', padding: '3px', textAlign: 'center', fontWeight: 800, borderTop: '1px solid #a7f3d0', color: '#059669' }}>AFTER</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Standard yard photos display */
                        (job.photoFrontUrl || job.photoBackUrl) && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>📸 Uploaded Yard Photos</div>
                            <div style={{ display: 'flex', gap: 10 }}>
                              {job.photoFrontUrl && (
                                <div style={{ flex: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid #cbd5e1', height: 100 }}>
                                  <img src={job.photoFrontUrl} alt="Front Yard" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  <div style={{ fontSize: 9, background: '#f8fafc', padding: '3px', textAlign: 'center', fontWeight: 700, borderTop: '1px solid #cbd5e1', color: '#475569' }}>FRONT</div>
                                </div>
                              )}
                              {job.photoBackUrl && (
                                <div style={{ flex: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid #cbd5e1', height: 100 }}>
                                  <img src={job.photoBackUrl} alt="Back Yard" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  <div style={{ fontSize: 9, background: '#f8fafc', padding: '3px', textAlign: 'center', fontWeight: 700, borderTop: '1px solid #cbd5e1', color: '#475569' }}>BACK</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      )}

                      {/* Job details checklist */}
                      <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 12, color: '#475569' }}>
                        <div><strong>Service Type:</strong> {job.serviceType?.replace('_', ' ').toUpperCase()}</div>
                        <div style={{ marginTop: 4 }}><strong>Tier:</strong> {job.scope?.replace('_', ' ').toUpperCase()} ({job.tier?.toUpperCase()})</div>
                        {job.customerNotes && (
                          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #cbd5e1' }}>
                            <strong>Notes:</strong> {job.customerNotes}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* DEV TOOLS DEV Simulation Buttons */}
                  <div style={{ borderTop: '1px dashed #e2e8f0', marginTop: 12, paddingTop: 12 }}>
                    {job.status === 'broadcast' && (
                      <button
                        disabled={actionLoading}
                        onClick={(e) => { e.stopPropagation(); triggerMockClaim(job.id); }}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '10px',
                          border: 'none',
                          background: '#1e293b',
                          color: '#38bdf8',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        📡 🧪 Dev Tool: Mock Provider Claim
                      </button>
                    )}

                    {nextStatus && (
                      <button
                        disabled={actionLoading}
                        onClick={(e) => { e.stopPropagation(); triggerStatusAdvance(job.id, nextStatus.status); }}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '10px',
                          border: 'none',
                          background: '#1e293b',
                          color: '#34d399',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        🚜 🧪 Dev Tool: {nextStatus.label}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div style={{ animation: 'fade-in 0.4s ease-out' }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>My Profile</h2>
            {profileLoading ? (
              <p style={{ color: '#94a3b8' }}>Loading profile...</p>
            ) : (
              <form onSubmit={saveProfile} style={{ ...card, background: '#fff' }}>
                {profileSuccess && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: '#ecfdf5',
                    color: '#065f46',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '16px',
                    border: '1px solid #a7f3d0'
                  }}>
                    {profileSuccess}
                  </div>
                )}
                {profileError && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: '#fef2f2',
                    color: '#991b1b',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '16px',
                    border: '1px solid #fecaca'
                  }}>
                    {profileError}
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Full Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    style={inputStyle}
                    placeholder="Enter your name"
                    required
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Phone Number</label>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    style={inputStyle}
                    placeholder="e.g. +16205550199"
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Street Address</label>
                  <input
                    type="text"
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    style={inputStyle}
                    placeholder="123 Main St"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input
                      type="text"
                      value={profileCity}
                      onChange={(e) => setProfileCity(e.target.value)}
                      style={{ ...inputStyle, marginTop: '6px' }}
                      placeholder="Liberal"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>State</label>
                    <input
                      type="text"
                      value={profileState}
                      onChange={(e) => setProfileState(e.target.value)}
                      style={{ ...inputStyle, marginTop: '6px' }}
                      placeholder="KS"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Zip Code</label>
                    <input
                      type="text"
                      value={profileZipCode}
                      onChange={(e) => setProfileZipCode(e.target.value)}
                      style={{ ...inputStyle, marginTop: '6px' }}
                      placeholder="67901"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={profileSaving}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    border: 'none',
                    background: '#059669',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '15px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(5,150,105,0.15)',
                    transition: 'all 0.2s',
                    opacity: profileSaving ? 0.7 : 1
                  }}
                >
                  {profileSaving ? 'Saving Changes...' : 'Save Profile'}
                </button>
              </form>
            )}

            <button
              onClick={handleSignOut}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid #ef4444',
                background: '#fff',
                color: '#ef4444',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: '12px'
              }}
            >
              Sign Out
            </button>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 16px calc(16px + env(safe-area-inset-bottom))',
        background: '#fff',
        borderTop: '1px solid #f1f5f9',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 100,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.03)'
      }}>
        <a href="/" style={{
          width: 56,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 24,
          textDecoration: 'none',
          background: '#f8fafc',
          fontSize: 20,
          border: '1px solid #f1f5f9'
        }}>🏠</a>
        
        <button onClick={() => handleTabChange('jobs')} style={{
          background: activeTab === 'jobs' ? '#f0fdf4' : 'transparent',
          width: 56,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 24,
          fontSize: 20,
          cursor: 'pointer',
          color: activeTab === 'jobs' ? '#059669' : '#cbd5e1',
          transition: 'all 0.2s',
          border: activeTab === 'jobs' ? '1px solid #d1fae5' : '1px solid transparent'
        }}>🗓️</button>
        
        <button onClick={() => handleTabChange('profile')} style={{
          background: activeTab === 'profile' ? '#f0fdf4' : 'transparent',
          width: 56,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 24,
          fontSize: 20,
          cursor: 'pointer',
          color: activeTab === 'profile' ? '#059669' : '#cbd5e1',
          transition: 'all 0.2s',
          border: activeTab === 'profile' ? '1px solid #d1fae5' : '1px solid transparent'
        }}>👤</button>
      </nav>

      {/* Conditionally rendered chat drawer and dispute modal */}
      {activeChatJobId && userId && (
        <ChatDrawer jobId={activeChatJobId} onClose={() => setActiveChatJobId(null)} currentUserId={userId} />
      )}

      {disputingJobId && (
        <DisputeModal 
          jobId={disputingJobId} 
          onClose={() => setDisputingJobId(null)} 
          onSubmitSuccess={() => {
            setDisputingJobId(null);
            fetchJobs();
          }} 
        />
      )}
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

// Live tracking map component
interface TrackingMapProps {
  customerLat: number;
  customerLng: number;
  providerLat: number;
  providerLng: number;
}

function TrackingMap({ customerLat, customerLng, providerLat, providerLng }: TrackingMapProps) {
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);
  const proMarkerRef = React.useRef<any>(null);
  const custMarkerRef = React.useRef<any>(null);

  useEffect(() => {
    const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
    if (!mapsKey || !mapContainerRef.current) return;

    const initMap = () => {
      if (!mapContainerRef.current || mapRef.current) return;

      const google = (window as any).google;
      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: providerLat, lng: providerLng },
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
      });
      mapRef.current = map;

      // Provider marker (Green)
      proMarkerRef.current = new google.maps.Marker({
        position: { lat: providerLat, lng: providerLng },
        map: map,
        title: 'Provider',
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
        },
      });

      // Customer/Job marker (Red)
      custMarkerRef.current = new google.maps.Marker({
        position: { lat: customerLat, lng: customerLng },
        map: map,
        title: 'Job Location',
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
        },
      });

      // Fit bounds to show both markers
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: providerLat, lng: providerLng });
      bounds.extend({ lat: customerLat, lng: customerLng });
      map.fitBounds(bounds);
    };

    if (!(window as any).google?.maps) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsKey}`;
      script.async = true;
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }
  }, []);

  // Update provider marker when coordinates change
  useEffect(() => {
    if (mapRef.current && proMarkerRef.current) {
      const pos = { lat: providerLat, lng: providerLng };
      proMarkerRef.current.setPosition(pos);
      
      const google = (window as any).google;
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(pos);
      bounds.extend({ lat: customerLat, lng: customerLng });
      mapRef.current.fitBounds(bounds);
    }
  }, [providerLat, providerLng, customerLat, customerLng]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ 
        width: '100%', 
        height: '200px', 
        borderRadius: '12px', 
        marginTop: '8px', 
        border: '1px solid #cbd5e1',
        overflow: 'hidden' 
      }} 
    />
  );
}

// Chat Drawer Component
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
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(16px)',
      boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid rgba(226, 232, 240, 0.8)',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fff',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Job Messages</h3>
          <span style={{ fontSize: 11, color: '#64748b' }}>Active Chat</span>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent',
          border: 'none',
          fontSize: 20,
          cursor: 'pointer',
          color: '#64748b',
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
                  background: isMe ? '#059669' : '#f1f5f9',
                  color: isMe ? '#fff' : '#1e293b',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
                <span style={{
                  fontSize: '9px',
                  color: '#94a3b8',
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
        background: '#fff',
        borderTop: '1px solid #f1f5f9',
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
            border: '1px solid #cbd5e1',
            outline: 'none',
            fontSize: '14px',
            fontFamily: 'inherit',
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

// Dispute Modal Component
function DisputeModal({ jobId, onClose, onSubmitSuccess }: { jobId: string; onClose: () => void; onSubmitSuccess: () => void }) {
  const [reason, setReason] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'disputes');

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setPhotoUrl(data.url);
        } else {
          setError('Failed to upload image');
        }
      } else {
        setError('Failed to upload image');
      }
    } catch (err) {
      setError('Error uploading image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !photoUrl || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/jobs/${jobId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, photoUrl }),
      });

      const data = await res.json();
      if (res.ok) {
        onSubmitSuccess();
      } else {
        setError(data.error || 'Failed to submit dispute');
      }
    } catch (err) {
      setError('Error submitting dispute');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '16px',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '24px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Dispute Completed Job</h3>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#fef2f2', color: '#991b1b', fontSize: '13px', fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Reason for Dispute</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why you are disputing this job in detail..."
            required
            style={{
              width: '100%',
              height: '100px',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              marginTop: '6px',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'none',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Photo Evidence</label>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '20px', marginTop: '6px', textAlign: 'center', background: '#f8fafc', position: 'relative' }}>
            {photoUrl ? (
              <div style={{ position: 'relative', width: '100%' }}>
                <img src={photoUrl} alt="Evidence" style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: '8px', objectFit: 'contain' }} />
                <button type="button" onClick={() => setPhotoUrl('')} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>✕</button>
              </div>
            ) : (
              <label style={{ cursor: 'pointer', display: 'block', width: '100%' }}>
                <span style={{ fontSize: '32px' }}>📸</span>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px', fontWeight: 600, color: '#059669' }}>
                  {uploading ? 'Uploading...' : 'Upload Photo Evidence'}
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>Tap to take photo or upload image</p>
                <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>

        <button type="submit" disabled={submitting || !reason.trim() || !photoUrl || uploading} style={{
          width: '100%',
          padding: '14px',
          borderRadius: '12px',
          border: 'none',
          background: '#ef4444',
          color: '#fff',
          fontWeight: 700,
          fontSize: '15px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          opacity: submitting || !reason.trim() || !photoUrl || uploading ? 0.6 : 1,
        }}>
          {submitting ? 'Submitting Dispute...' : 'Submit Dispute'}
        </button>
      </form>
    </div>
  );
}

import { db } from '@/lib/db';
import { APP_URL } from '@/lib/business';
import { dispatchSignal } from '@/lib/dispatch';
import { sendRawEmail } from '@/lib/email';

// ── Types ──────────────────────────────────────────────────────────
type NotificationType =
  | 'job_broadcast'
  | 'job_claimed'
  | 'job_completed'
  | 'job_cancelled'
  | 'payment'
  | 'review'
  | 'system';

interface NotifyOptions {
  userId: string;
  jobId?: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, any>;
}

// ── Core: Create Notification ──────────────────────────────────────
async function createNotification(opts: NotifyOptions, channel: string = 'in_app') {
  return db.notification.create({
    data: {
      userId: opts.userId,
      jobId: opts.jobId || null,
      type: opts.type,
      channel,
      title: opts.title,
      body: opts.body,
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
      isSent: channel === 'in_app',
      sentAt: channel === 'in_app' ? new Date() : null,
    },
  });
}

// ── Send Email Alert (via Resend) ──────────────────────────────────
async function sendEmailNotification(
  email: string,
  subject: string,
  textBody: string
): Promise<boolean> {
  // Build a clean HTML version
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #fafafa;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 28px; font-weight: 900; letter-spacing: -1px; color: #166534; margin: 0;">TERRAZAS</h1>
        <p style="color: #94a3b8; font-size: 11px; margin-top: 4px;">Premium On-Demand Lawn Care</p>
      </div>
      <div style="background: white; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        ${textBody.split('\n').map(line =>
          line.trim() ? `<p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 8px 0;">${line}</p>` : '<br/>'
        ).join('')}
      </div>
      <div style="text-align: center; margin-top: 24px;">
        <a href="${APP_URL}" style="display: inline-block; background: #166534; color: white; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-weight: 700; font-size: 14px;">Open Terrazas</a>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 10px; margin-top: 24px;">
        © ${new Date().getFullYear()} Terrazas · Liberal, KS · <a href="${APP_URL}" style="color: #94a3b8;">terrazas.app</a>
      </p>
    </div>
  `;

  const result = await sendRawEmail(email, subject, htmlBody, textBody);
  return result.success;
}

// ── Broadcast Job to Providers ─────────────────────────────────────
// This is the main function called when a customer posts a job.
// It finds all eligible providers and sends them an alert.
export async function broadcastJobToProviders(jobId: string) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { customer: true },
  });

  if (!job) throw new Error(`Job ${jobId} not found`);

  // Find active providers whose coverage area includes this zip code
  const allProviders = await db.provider.findMany({
    where: { isActive: true },
    include: {
      user: {
        include: { notificationPrefs: true },
      },
    },
  });

  // Filter providers that serve this zip code
  const eligibleProviders = allProviders.filter((p) => {
    try {
      const zips: string[] = JSON.parse(p.zipCodes);
      return zips.includes(job.zipCode);
    } catch {
      return false;
    }
  });

  console.log(`📡 Broadcasting job ${jobId} to ${eligibleProviders.length} providers in ${job.zipCode}`);

  const notifications = [];

  for (const provider of eligibleProviders) {
    const title = '🔔 New Job Available!';
    const body = `${job.serviceType === 'mowing' ? '🌱' : '🏡'} ${job.tier.charAt(0).toUpperCase() + job.tier.slice(1)} ${job.serviceType} in ${job.zipCode} — $${job.price.toFixed(2)}. Claim it before someone else does!`;

    // Always create in-app notification
    const notification = await createNotification({
      userId: provider.userId,
      jobId: job.id,
      type: 'job_broadcast',
      title,
      body,
      metadata: {
        jobPrice: job.price,
        serviceType: job.serviceType,
        tier: job.tier,
        zipCode: job.zipCode,
        customerName: job.customer.name || 'Customer',
      },
    });

    notifications.push(notification);

    // Send email if enabled
    const prefs = provider.user.notificationPrefs;
    const emailEnabled = !prefs || prefs.emailEnabled; // Default to true
    const shouldNotifyBroadcast = !prefs || prefs.jobBroadcast; // Default to true

    if (emailEnabled && shouldNotifyBroadcast && provider.email) {
      // Check quiet hours
      if (!isQuietHours(prefs?.quietStart, prefs?.quietEnd)) {
        await sendEmailNotification(
          provider.email,
          `🔔 New ${job.tier} ${job.serviceType} job — $${job.price.toFixed(2)}`,
          `Hey ${provider.user.name || provider.businessName}!\n\n` +
          `A new job just dropped in your area:\n\n` +
          `📍 ${job.address || job.zipCode}\n` +
          `🔧 ${job.tier.charAt(0).toUpperCase() + job.tier.slice(1)} ${job.serviceType}\n` +
          `💰 $${job.price.toFixed(2)}\n\n` +
          `Claim it now: ${APP_URL}/pro\n\n` +
          `— Terrazas`
        );

        // Mark email as sent
        await db.notification.create({
          data: {
            userId: provider.userId,
            jobId: job.id,
            type: 'job_broadcast',
            channel: 'email',
            title,
            body,
            isSent: true,
            sentAt: new Date(),
          },
        });
      }
    }
  }

  // Update job with broadcast timestamp
  await db.job.update({
    where: { id: jobId },
    data: { broadcastedAt: new Date() },
  });

  return {
    jobId,
    providersNotified: eligibleProviders.length,
    notifications: notifications.length,
  };
}

// ── Notify Customer: Job Claimed ───────────────────────────────────
// Uses System 4 multi-channel dispatch: Push → SMS → Email
export async function notifyJobClaimed(jobId: string) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { customer: true, provider: true },
  });

  if (!job || !job.provider) return;

  // Two flavors: a quote was sent (needs customer acceptance) vs the
  // booking was accepted outright (job is scheduled).
  const isQuote = job.status === 'pending_approval' && !!job.quotedPrice;

  await dispatchSignal({
    userId: job.customerId,
    jobId: job.id,
    type: isQuote ? 'quote_sent' : 'job_claimed',
    title: isQuote ? '💵 Your quote is ready!' : '✅ You’re on the schedule!',
    body: isQuote
      ? `${job.provider.businessName} quoted $${job.quotedPrice!.toFixed(2)} for your ${job.serviceType} request.\n\nReview and accept it: ${APP_URL}/dashboard`
      : `${job.provider.businessName} accepted your ${job.serviceType} booking.\n\nTrack your service: ${APP_URL}/dashboard`,
    priority: 'action',
    metadata: {
      providerName: job.provider.businessName,
      etaMinutes: job.etaMinutes || 30,
      quotedPrice: job.quotedPrice || undefined,
    },
  });
}

// ── Notify Customer: Job Completed ─────────────────────────────────
// Uses System 4 multi-channel dispatch
export async function notifyJobCompleted(jobId: string) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { customer: true, provider: true },
  });

  if (!job || !job.provider) return;

  // System 4: Multi-channel cascade (rich priority = Email with details)
  await dispatchSignal({
    userId: job.customerId,
    jobId: job.id,
    type: 'job_completed',
    title: '🎉 Job complete!',
    body: `${job.provider.businessName} finished your ${job.serviceType}.\n\n💰 Total charged: $${job.customerTotal.toFixed(2)}\n\nLeave a review: ${APP_URL}/review?jobId=${job.id}`,
    priority: 'rich', // Rich content — email with receipt details
    metadata: {
      providerName: job.provider.businessName,
      customerTotal: job.customerTotal,
    },
  });
}

// ── Get User Notifications ─────────────────────────────────────────
export async function getUserNotifications(userId: string, limit: number = 20) {
  return db.notification.findMany({
    where: { userId, channel: 'in_app' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ── Mark Notification Read ─────────────────────────────────────────
// Scoped to the owning user — updateMany makes a non-owned id a no-op (no IDOR).
export async function markNotificationRead(notificationId: string, userId: string) {
  return db.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  });
}

// ── Get Unread Count ───────────────────────────────────────────────
export async function getUnreadCount(userId: string) {
  return db.notification.count({
    where: { userId, isRead: false, channel: 'in_app' },
  });
}

// ── Helper: Check Quiet Hours ──────────────────────────────────────
function isQuietHours(start?: string | null, end?: string | null): boolean {
  if (!start || !end) return false;

  const now = new Date();
  const hours = now.getHours();
  const mins = now.getMinutes();
  const currentTime = hours * 60 + mins;

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startTime = startH * 60 + startM;
  const endTime = endH * 60 + endM;

  if (startTime < endTime) {
    return currentTime >= startTime && currentTime < endTime;
  } else {
    // Wraps midnight (e.g., 22:00 to 07:00)
    return currentTime >= startTime || currentTime < endTime;
  }
}

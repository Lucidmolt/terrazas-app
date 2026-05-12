import { db } from '@/lib/db';
import { Resend } from 'resend';

// ── Email Provider ─────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// From address — uses terrazas.app domain when verified, otherwise Resend default
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Terrazas <onboarding@resend.dev>';

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
        <a href="https://terrazas.app" style="display: inline-block; background: #166534; color: white; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-weight: 700; font-size: 14px;">Open Terrazas</a>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 10px; margin-top: 24px;">
        © ${new Date().getFullYear()} Terrazas · Liberal, KS · <a href="https://terrazas.app" style="color: #94a3b8;">terrazas.app</a>
      </p>
    </div>
  `;

  if (!resend) {
    // No Resend key — log for development
    console.log(`📧 EMAIL (mock) → ${email}: ${subject}`);
    console.log(`   ${textBody.substring(0, 100)}...`);
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      text: textBody,
      html: htmlBody,
    });

    if (error) {
      console.error(`📧 EMAIL FAILED → ${email}:`, error);
      return false;
    }

    console.log(`📧 EMAIL SENT → ${email}: ${subject}`);
    return true;
  } catch (err) {
    console.error(`📧 EMAIL ERROR → ${email}:`, err);
    return false;
  }
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
          `Claim it now: https://terrazas.app/pro\n\n` +
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
export async function notifyJobClaimed(jobId: string) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { customer: true, provider: true },
  });

  if (!job || !job.provider) return;

  const title = '✅ Your job was claimed!';
  const body = `${job.provider.businessName} is on their way! ETA: ${job.etaMinutes || 30} minutes.`;

  await createNotification({
    userId: job.customerId,
    jobId: job.id,
    type: 'job_claimed',
    title,
    body,
    metadata: {
      providerName: job.provider.businessName,
      etaMinutes: job.etaMinutes || 30,
    },
  });

  // Email the customer
  if (job.customer.email) {
    await sendEmailNotification(
      job.customer.email,
      '✅ Your lawn care pro is on the way!',
      `Hi ${job.customer.name || 'there'}!\n\n` +
      `Great news — ${job.provider.businessName} has claimed your ${job.serviceType} job.\n` +
      `Estimated arrival: ${job.etaMinutes || 30} minutes.\n\n` +
      `Track your job: https://terrazas.app\n\n` +
      `— Terrazas`
    );
  }
}

// ── Notify Customer: Job Completed ─────────────────────────────────
export async function notifyJobCompleted(jobId: string) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { customer: true, provider: true },
  });

  if (!job || !job.provider) return;

  const title = '🎉 Job complete!';
  const body = `${job.provider.businessName} finished your ${job.serviceType}. Leave a review!`;

  await createNotification({
    userId: job.customerId,
    jobId: job.id,
    type: 'job_completed',
    title,
    body,
  });

  if (job.customer.email) {
    await sendEmailNotification(
      job.customer.email,
      '🎉 Your yard looks great!',
      `Hi ${job.customer.name || 'there'}!\n\n` +
      `${job.provider.businessName} just finished your ${job.serviceType}.\n\n` +
      `💰 Total charged: $${job.customerTotal.toFixed(2)}\n` +
      `Leave a review: https://terrazas.app/review?jobId=${job.id}\n\n` +
      `— Terrazas`
    );
  }
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
export async function markNotificationRead(notificationId: string) {
  return db.notification.update({
    where: { id: notificationId },
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

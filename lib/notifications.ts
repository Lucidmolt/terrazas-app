// ── Notification Dispatch System ─────────────────────────────────────
// Handles sending alerts to providers when jobs are broadcasted,
// and to customers when jobs are claimed/completed.
//
// Channels:
//   1. In-app (always) — stored in Notification table
//   2. Email (via Supabase/Resend) — for users with email enabled
//   3. SMS (via Twilio) — future, for providers with phone verified
//   4. Push (via Web Push) — future, for PWA users

import { db } from '@/lib/db';

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
      isSent: channel === 'in_app', // In-app is instant
      sentAt: channel === 'in_app' ? new Date() : null,
    },
  });
}

// ── Send Email Alert ───────────────────────────────────────────────
async function sendEmailNotification(
  email: string,
  subject: string,
  body: string
): Promise<boolean> {
  // Use Supabase Edge Function or direct SMTP
  // For now, log it — will wire to Resend/SendGrid later
  console.log(`📧 EMAIL → ${email}: ${subject}`);
  console.log(`   ${body}`);

  // TODO: Wire to email provider
  // const res = await fetch('https://api.resend.com/emails', {
  //   method: 'POST',
  //   headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ from: 'Terrazas <alerts@terrazas.app>', to: email, subject, text: body }),
  // });
  // return res.ok;

  return true; // Mock success for now
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

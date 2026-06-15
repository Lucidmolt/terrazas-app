// ── System 4: Multi-Channel Fallback Notification Engine ────────────
// Guaranteed delivery of the 'Handoff' signal via cascading channels.
//
// Priority chain:
//   Route 1: WebPush (timeout: 2min) → if not delivered...
//   Route 2: SMS via Twilio (immediate) → always also send...
//   Route 3: Email via Resend (immediate, rich content)
//
// Each attempt is logged to the Notification table with its channel.

import { db } from '@/lib/db';
import { Resend } from 'resend';

// ── Provider Configs ────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER || '';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Terrazas <onboarding@resend.dev>';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// ── Types ───────────────────────────────────────────────────────────
interface HandoffSignal {
  userId: string;
  jobId: string;
  type: 'job_broadcast' | 'job_claimed' | 'job_completed' | 'job_cancelled' | 'system';
  title: string;
  body: string;
  priority: 'action' | 'info' | 'rich'; // action = SMS, rich = email, info = in-app only
  metadata?: Record<string, any>;
}

interface DeliveryResult {
  channel: string;
  success: boolean;
  error?: string;
}

// ── Route 1: WebPush ────────────────────────────────────────────────
async function sendWebPush(userId: string, title: string, body: string): Promise<DeliveryResult> {
  try {
    // Get user's push preferences
    const prefs = await db.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs?.pushEnabled) {
      return { channel: 'push', success: false, error: 'Push notifications not enabled by user' };
    }

    // Get all subscriptions registered under PushSubscription
    const dbSubscriptions = await db.pushSubscription.findMany({
      where: { userId },
    });

    const subscriptions: any[] = [];

    // Map new model format
    if (dbSubscriptions.length > 0) {
      dbSubscriptions.forEach(sub => {
        subscriptions.push({
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth,
            p256dh: sub.p256dh,
          },
        });
      });
    } else if (prefs.pushSubscription) {
      // Fallback to legacy single-field subscription
      try {
        subscriptions.push(JSON.parse(prefs.pushSubscription));
      } catch (parseErr) {
        console.error('Failed to parse legacy pushSubscription JSON:', parseErr);
      }
    }

    if (subscriptions.length === 0) {
      return { channel: 'push', success: false, error: 'No push subscriptions found for user' };
    }

    // WebPush requires VAPID keys — check if configured
    const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return { channel: 'push', success: false, error: 'VAPID keys not configured' };
    }

    // Dynamic require web-push only when installed
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const webpush = require('web-push') as any;
      webpush.setVapidDetails(
        'mailto:support@terrazas.app',
        VAPID_PUBLIC,
        VAPID_PRIVATE
      );

      let successCount = 0;
      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({ title, body, icon: '/icon-192.png', badge: '/icon-192.png' })
          );
          successCount++;
        } catch (subErr: any) {
          console.error(`📲 PUSH SUB DEVICE SEND FAILED:`, subErr.message);
          // Auto-clean expired subscriptions (410 Gone / 404 Not Found)
          if (subErr.statusCode === 410 || subErr.statusCode === 404) {
            await db.pushSubscription.deleteMany({
              where: { endpoint: subscription.endpoint },
            });
          }
        }
      }

      if (successCount > 0) {
        console.log(`📲 PUSH SENT → user ${userId}: ${title} (${successCount} devices)`);
        return { channel: 'push', success: true };
      }

      return { channel: 'push', success: false, error: 'All push subscription deliveries failed' };
    } catch (requireErr) {
      // web-push package not installed — graceful fallback
      return { channel: 'push', success: false, error: 'web-push not available' };
    }
  } catch (err: any) {
    console.error(`📲 PUSH FAILED → user ${userId}:`, err.message);
    return { channel: 'push', success: false, error: err.message };
  }
}

// ── Route 2: SMS via Twilio ─────────────────────────────────────────
async function sendSMS(phone: string, body: string): Promise<DeliveryResult> {
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_PHONE) {
    console.log(`📱 SMS (mock) → ${phone}: ${body.substring(0, 80)}...`);
    return { channel: 'sms', success: false, error: 'Twilio not configured' };
  }

  try {
    // Use Twilio REST API directly (no SDK needed)
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: TWILIO_PHONE,
        To: phone,
        Body: body,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`📱 SMS FAILED → ${phone}:`, error);
      return { channel: 'sms', success: false, error };
    }

    console.log(`📱 SMS SENT → ${phone}: ${body.substring(0, 80)}...`);
    return { channel: 'sms', success: true };
  } catch (err: any) {
    console.error(`📱 SMS ERROR → ${phone}:`, err.message);
    return { channel: 'sms', success: false, error: err.message };
  }
}

// ── Route 3: Email via Resend ───────────────────────────────────────
async function sendEmail(email: string, subject: string, textBody: string): Promise<DeliveryResult> {
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
    console.log(`📧 EMAIL (mock) → ${email}: ${subject}`);
    return { channel: 'email', success: false, error: 'Resend not configured' };
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
      return { channel: 'email', success: false, error: JSON.stringify(error) };
    }

    console.log(`📧 EMAIL SENT → ${email}: ${subject}`);
    return { channel: 'email', success: true };
  } catch (err: any) {
    console.error(`📧 EMAIL ERROR → ${email}:`, err.message);
    return { channel: 'email', success: false, error: err.message };
  }
}

// ── Master Dispatch: Multi-Channel Cascade ──────────────────────────
// Attempts delivery via all available channels based on priority.
// action priority: Push → SMS → Email (all attempted, SMS for urgency)
// rich priority:   Email (detailed content)
// info priority:   In-app only
export async function dispatchSignal(signal: HandoffSignal): Promise<{
  delivered: boolean;
  channels: DeliveryResult[];
}> {
  const channels: DeliveryResult[] = [];

  // Always create in-app notification
  await db.notification.create({
    data: {
      userId: signal.userId,
      jobId: signal.jobId,
      type: signal.type,
      channel: 'in_app',
      title: signal.title,
      body: signal.body,
      isSent: true,
      sentAt: new Date(),
      metadata: signal.metadata ? JSON.stringify(signal.metadata) : null,
    },
  });

  // Info priority: in-app only, done
  if (signal.priority === 'info') {
    return { delivered: true, channels: [{ channel: 'in_app', success: true }] };
  }

  // Get user contact info and preferences
  const user = await db.user.findUnique({
    where: { id: signal.userId },
    include: { notificationPrefs: true },
  });

  if (!user) {
    return { delivered: false, channels: [{ channel: 'in_app', success: true }] };
  }

  const prefs = user.notificationPrefs;

  // ── Route 1: WebPush (if enabled) ──
  if (signal.priority === 'action' && prefs?.pushEnabled) {
    const pushResult = await sendWebPush(signal.userId, signal.title, signal.body);
    channels.push(pushResult);

    // Log push notification attempt
    await db.notification.create({
      data: {
        userId: signal.userId,
        jobId: signal.jobId,
        type: signal.type,
        channel: 'push',
        title: signal.title,
        body: signal.body,
        isSent: pushResult.success,
        sentAt: pushResult.success ? new Date() : null,
      },
    });

    // If push succeeded, skip SMS (but still send email for rich content)
    if (pushResult.success && signal.priority !== 'action') {
      return { delivered: true, channels };
    }
  }

  // ── Route 2: SMS (for action priority, if phone available) ──
  if (signal.priority === 'action' && user.phone && prefs?.smsEnabled !== false) {
    // Build clean SMS body (no HTML, max 160 chars for single-segment)
    const smsBody = `Terrazas: ${signal.title} — ${signal.body}`.substring(0, 160);
    const smsResult = await sendSMS(user.phone, smsBody);
    channels.push(smsResult);

    await db.notification.create({
      data: {
        userId: signal.userId,
        jobId: signal.jobId,
        type: signal.type,
        channel: 'sms',
        title: signal.title,
        body: smsBody,
        isSent: smsResult.success,
        sentAt: smsResult.success ? new Date() : null,
      },
    });
  }

  // ── Route 3: Email (always for rich + action priority) ──
  if (user.email && prefs?.emailEnabled !== false) {
    const emailResult = await sendEmail(
      user.email,
      signal.title,
      signal.body
    );
    channels.push(emailResult);

    await db.notification.create({
      data: {
        userId: signal.userId,
        jobId: signal.jobId,
        type: signal.type,
        channel: 'email',
        title: signal.title,
        body: signal.body,
        isSent: emailResult.success,
        sentAt: emailResult.success ? new Date() : null,
      },
    });
  }

  const delivered = channels.some(c => c.success);
  return { delivered, channels };
}

// ── Convenience: Dispatch to Multiple Users ─────────────────────────
export async function dispatchToMany(
  userIds: string[],
  signal: Omit<HandoffSignal, 'userId'>
): Promise<{ totalSent: number; failures: string[] }> {
  let totalSent = 0;
  const failures: string[] = [];

  for (const userId of userIds) {
    const result = await dispatchSignal({ ...signal, userId });
    if (result.delivered) {
      totalSent++;
    } else {
      failures.push(userId);
    }
  }

  return { totalSent, failures };
}

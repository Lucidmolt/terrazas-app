// ── Terrazas Email Service ──────────────────────────────────────────
// Transactional emails via Resend from updates.terrazas.app
//
// Events:
//   - Job claimed → notify customer
//   - Job completed → notify customer (with photo)
//   - Provider approved → notify provider
//   - Payout processed → notify provider
//   - Welcome email → new user

import { Resend } from 'resend';
import { APP_URL } from '@/lib/business';

const resendKey = process.env.RESEND_API_KEY || '';
const fromEmail = process.env.RESEND_FROM_EMAIL || 'Terrazas <alerts@updates.terrazas.app>';
const resend = resendKey ? new Resend(resendKey) : null;

// ── Shared HTML wrapper ─────────────────────────────────────────────
function emailWrapper(content: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; background: #f8fafc; padding: 32px 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 28px; font-weight: 900; color: #059669; letter-spacing: -0.04em; margin: 0;">TERRAZAS</h1>
      </div>
      <div style="background: #fff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
        ${content}
      </div>
      <div style="text-align: center; margin-top: 24px; padding: 16px;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">Terrazas.app — Premium On-Demand Lawn Care</p>
        <p style="font-size: 10px; color: #cbd5e1; margin: 4px 0 0;">You received this because you have an account on terrazas.app</p>
      </div>
    </div>
  `;
}

// ── Send Raw Email ──────────────────────────────────────────────────
// The ONE place the app talks to Resend. All email senders (this module,
// lib/notifications.ts, lib/dispatch.ts) route through here so email is
// reconfigured by setting exactly two env vars:
//   RESEND_API_KEY    — API key from resend.com
//   RESEND_FROM_EMAIL — verified sender, e.g. 'Terrazas <alerts@yourdomain.com>'
export async function sendRawEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.log(`[Email] Mock (no RESEND_API_KEY) → ${to}: ${subject}`);
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });
    if (error) {
      console.error(`[Email] Failed → ${to}: ${JSON.stringify(error)}`);
      return { success: false, error: JSON.stringify(error) };
    }
    console.log(`[Email] Sent → ${to}: ${subject}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Email] Failed → ${to}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ── Send Email (branded wrapper) ────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  return sendRawEmail(to, subject, emailWrapper(html));
}

// ── Job Claimed — Notify Customer ───────────────────────────────────
export async function sendJobClaimedEmail(
  customerEmail: string,
  providerName: string,
  jobAddress: string,
  eta: string
) {
  return sendEmail(customerEmail, `🎉 Your lawn pro is confirmed!`, `
    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 8px;">Your pro is on the way!</h2>
    <p style="font-size: 14px; color: #64748b; margin: 0 0 24px;">Great news — a verified pro has accepted your lawn care request.</p>
    
    <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">YOUR PRO</div>
      <div style="font-size: 18px; font-weight: 800; color: #059669;">${providerName}</div>
    </div>

    <table style="width: 100%; font-size: 14px; color: #334155;">
      <tr>
        <td style="padding: 8px 0; color: #94a3b8; font-weight: 600;">📍 Address</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 700;">${jobAddress}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #94a3b8; font-weight: 600;">⏰ ETA</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 700;">${eta}</td>
      </tr>
    </table>

    <p style="font-size: 12px; color: #94a3b8; margin: 20px 0 0;">Track your service in real-time at <a href="${APP_URL}/dashboard" style="color: #059669; font-weight: 700;">terrazas.app/dashboard</a></p>
  `);
}

// ── Job Completed — Notify Customer ─────────────────────────────────
export async function sendJobCompletedEmail(
  customerEmail: string,
  providerName: string,
  jobPrice: string,
  completionPhotoUrl?: string
) {
  const photoBlock = completionPhotoUrl
    ? `<div style="margin: 20px 0;"><img src="${completionPhotoUrl}" alt="Completed work" style="width: 100%; border-radius: 12px; border: 1px solid #e2e8f0;" /></div>`
    : '';

  return sendEmail(customerEmail, `✅ Your lawn service is complete!`, `
    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 8px;">Service Complete!</h2>
    <p style="font-size: 14px; color: #64748b; margin: 0 0 24px;">${providerName} has finished your lawn care service.</p>

    ${photoBlock}

    <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
      <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">TOTAL CHARGED</div>
      <div style="font-size: 28px; font-weight: 900; color: #059669;">$${jobPrice}</div>
    </div>

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">Thank you for using Terrazas! Please rate your experience in the app.</p>
  `);
}

// ── Provider Approved — Notify Provider ─────────────────────────────
export async function sendProviderApprovedEmail(
  providerEmail: string,
  businessName: string,
  proTier: string
) {
  return sendEmail(providerEmail, `🎉 Welcome to Terrazas Pro!`, `
    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 8px;">You're approved!</h2>
    <p style="font-size: 14px; color: #64748b; margin: 0 0 24px;">Welcome to Terrazas, ${businessName}. Your application has been reviewed and approved.</p>

    <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
      <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">YOUR TIER</div>
      <div style="font-size: 18px; font-weight: 800; color: #059669;">${proTier === '0' ? '🌱 Community Pro' : '✓ Verified Pro'}</div>
    </div>

    <p style="font-size: 14px; color: #334155; font-weight: 600; margin-bottom: 12px;">What's next:</p>
    <ol style="font-size: 13px; color: #64748b; padding-left: 20px;">
      <li style="margin-bottom: 8px;">Complete your Stripe setup to receive payouts</li>
      <li style="margin-bottom: 8px;">Turn on your availability in the Pro Dashboard</li>
      <li style="margin-bottom: 8px;">Start accepting jobs in your area!</li>
    </ol>

    <a href="${APP_URL}/pro" style="display: block; text-align: center; padding: 14px; background: #059669; color: #fff; border-radius: 12px; font-weight: 800; font-size: 15px; text-decoration: none; margin-top: 24px;">Open Pro Dashboard →</a>
  `);
}

// ── Payout Processed — Notify Provider ──────────────────────────────
export async function sendPayoutEmail(
  providerEmail: string,
  amount: string,
  type: 'weekly' | 'instant',
  fee: string = '0'
) {
  return sendEmail(providerEmail, `💰 Payout of $${amount} ${type === 'instant' ? 'sent' : 'scheduled'}!`, `
    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 8px;">${type === 'instant' ? 'Instant Payout Sent!' : 'Weekly Payout Processed!'}</h2>
    <p style="font-size: 14px; color: #64748b; margin: 0 0 24px;">${type === 'instant' ? 'Your funds have been sent to your bank account.' : 'Your weekly earnings have been deposited.'}</p>

    <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
      <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">AMOUNT</div>
      <div style="font-size: 32px; font-weight: 900; color: #059669;">$${amount}</div>
      ${parseFloat(fee) > 0 ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Instant fee: -$${fee}</div>` : ''}
    </div>

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">View your full earnings history at <a href="${APP_URL}/pro" style="color: #059669; font-weight: 700;">terrazas.app/pro</a></p>
  `);
}

// ── New Request — Notify the Business ───────────────────────────────
export async function sendNewRequestEmail(
  businessEmail: string,
  opts: {
    requestType: string // 'book' | 'quote'
    serviceName: string
    address: string
    preferredDate?: string
    customerName?: string
    total?: string // set for fixed-price bookings
  }
) {
  const isQuote = opts.requestType === 'quote'
  const subject = isQuote
    ? `📋 New quote request — ${opts.serviceName}`
    : `🌱 New booking — ${opts.serviceName}`
  return sendEmail(businessEmail, subject, `
    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 8px;">${isQuote ? 'New Quote Request' : 'New Booking'}</h2>
    <p style="font-size: 14px; color: #64748b; margin: 0 0 24px;">${opts.customerName || 'A customer'} just ${isQuote ? 'requested a quote' : 'booked a service'} on your site.</p>

    <table style="width: 100%; font-size: 14px; color: #334155;">
      <tr><td style="padding: 8px 0; color: #94a3b8; font-weight: 600;">Service</td><td style="padding: 8px 0; text-align: right; font-weight: 700;">${opts.serviceName}</td></tr>
      <tr><td style="padding: 8px 0; color: #94a3b8; font-weight: 600;">📍 Address</td><td style="padding: 8px 0; text-align: right; font-weight: 700;">${opts.address}</td></tr>
      ${opts.preferredDate ? `<tr><td style="padding: 8px 0; color: #94a3b8; font-weight: 600;">📅 Preferred date</td><td style="padding: 8px 0; text-align: right; font-weight: 700;">${opts.preferredDate}</td></tr>` : ''}
      ${opts.total ? `<tr><td style="padding: 8px 0; color: #94a3b8; font-weight: 600;">💵 Total</td><td style="padding: 8px 0; text-align: right; font-weight: 700;">$${opts.total}</td></tr>` : ''}
    </table>

    <a href="${APP_URL}/pro" style="display: block; text-align: center; padding: 14px; background: #059669; color: #fff; border-radius: 12px; font-weight: 800; font-size: 15px; text-decoration: none; margin-top: 24px;">${isQuote ? 'Review & Send Quote →' : 'Review & Accept →'}</a>
  `)
}

// ── Welcome Email — New User ────────────────────────────────────────
export async function sendWelcomeEmail(email: string, name: string) {
  return sendEmail(email, `Welcome to Terrazas! 🌿`, `
    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 8px;">Welcome, ${name}!</h2>
    <p style="font-size: 14px; color: #64748b; margin: 0 0 24px;">Your Terrazas account is ready. Book premium lawn care in under 60 seconds.</p>

    <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <p style="font-size: 14px; color: #334155; font-weight: 600; margin: 0 0 12px;">How it works:</p>
      <div style="font-size: 13px; color: #64748b; line-height: 2;">
        1️⃣ Enter your zip code<br>
        2️⃣ Select your service tier<br>
        3️⃣ A verified pro claims your job<br>
        4️⃣ Get a completion photo when done
      </div>
    </div>

    <a href="${APP_URL}" style="display: block; text-align: center; padding: 14px; background: #059669; color: #fff; border-radius: 12px; font-weight: 800; font-size: 15px; text-decoration: none;">Book Your First Service →</a>
  `);
}

// ── Check if email is configured ────────────────────────────────────
export function isEmailConfigured(): boolean {
  return !!resend;
}

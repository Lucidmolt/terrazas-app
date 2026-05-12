import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-04-30.basil' as any });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// POST /api/webhooks/stripe — Handle Stripe webhook events
export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature') || '';

  let event: Stripe.Event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      // Dev mode: parse without signature verification
      event = JSON.parse(body) as Stripe.Event;
      console.warn('[Stripe Webhook] No webhook secret — skipping signature verification');
    }
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const jobId = pi.metadata?.jobId;
        if (jobId) {
          await db.job.update({
            where: { id: jobId },
            data: {
              paymentIntentId: pi.id,
              status: 'broadcast',
              broadcastedAt: new Date(),
            },
          });
          console.log(`[Stripe] Payment succeeded for job ${jobId}`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const jobId = pi.metadata?.jobId;
        if (jobId) {
          await db.job.update({
            where: { id: jobId },
            data: {
              status: 'cancelled',
              cancelReason: 'Payment failed',
              cancelledAt: new Date(),
            },
          });
          console.log(`[Stripe] Payment failed for job ${jobId}`);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const pi = charge.payment_intent as string;
        if (pi) {
          const job = await db.job.findFirst({ where: { paymentIntentId: pi } });
          if (job) {
            await db.job.update({
              where: { id: job.id },
              data: {
                status: 'cancelled',
                cancelReason: 'Payment refunded',
                cancelledAt: new Date(),
              },
            });
          }
        }
        break;
      }

      case 'account.updated': {
        // Stripe Connect: provider account status changed
        const account = event.data.object as Stripe.Account;
        if (account.id) {
          const provider = await db.provider.findFirst({
            where: { stripeAccountId: account.id },
          });
          if (provider) {
            await db.provider.update({
              where: { id: provider.id },
              data: {
                bankLinked: account.payouts_enabled || false,
              },
            });
          }
        }
        break;
      }

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Processing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

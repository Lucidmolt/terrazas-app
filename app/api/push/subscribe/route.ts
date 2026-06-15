import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// POST /api/push/subscribe — Register or update a web push subscription
export async function POST(request: Request) {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    const subscription = body.subscription;
    
    const endpoint = subscription?.endpoint || body.endpoint;
    const auth = subscription?.keys?.auth || body.auth;
    const p256dh = subscription?.keys?.p256dh || body.p256dh;

    if (!endpoint || !auth || !p256dh) {
      return NextResponse.json(
        { error: 'endpoint, auth, and p256dh are required' },
        { status: 400 }
      );
    }

    // Save or update subscription
    const pushSub = await db.pushSubscription.upsert({
      where: {
        endpoint,
      },
      update: {
        userId: dbUser!.id,
        auth,
        p256dh,
      },
      create: {
        userId: dbUser!.id,
        endpoint,
        auth,
        p256dh,
      },
    });

    return NextResponse.json({ success: true, subscription: pushSub });
  } catch (error: any) {
    console.error('[Push Subscription API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to register subscription' },
      { status: 500 }
    );
  }
}

// DELETE /api/push/subscribe — Unregister a web push subscription
export async function DELETE(request: Request) {
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
    }

    await db.pushSubscription.deleteMany({
      where: {
        endpoint,
        userId: dbUser!.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Push Subscription API] DELETE Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete subscription' },
      { status: 500 }
    );
  }
}

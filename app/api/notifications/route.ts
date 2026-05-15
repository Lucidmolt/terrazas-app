import { NextResponse } from 'next/server';
import { getUserNotifications, markNotificationRead, getUnreadCount } from '@/lib/notifications';
import { requireAuth } from '@/lib/api-auth';

// GET /api/notifications — get notifications for the authenticated user
export async function GET(request: Request) {
  // C1 FIX: Require authentication — scope to authenticated user
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const userId = dbUser!.id;

  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(userId, parseInt(searchParams.get('limit') || '20')),
    getUnreadCount(userId),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

// POST /api/notifications — mark notification as read
export async function POST(request: Request) {
  // C1 FIX: Require authentication
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  const { notificationId } = await request.json();

  if (!notificationId) {
    return NextResponse.json({ error: 'notificationId is required' }, { status: 400 });
  }

  const notification = await markNotificationRead(notificationId);
  return NextResponse.json({ notification });
}

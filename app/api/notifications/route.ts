import { NextResponse } from 'next/server';
import { getUserNotifications, markNotificationRead, getUnreadCount } from '@/lib/notifications';

// GET /api/notifications?userId=...&limit=20
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(userId, parseInt(searchParams.get('limit') || '20')),
    getUnreadCount(userId),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

// POST /api/notifications — mark notification as read
export async function POST(request: Request) {
  const { notificationId } = await request.json();

  if (!notificationId) {
    return NextResponse.json({ error: 'notificationId is required' }, { status: 400 });
  }

  const notification = await markNotificationRead(notificationId);
  return NextResponse.json({ notification });
}

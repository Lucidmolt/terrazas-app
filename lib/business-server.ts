// Server-side helpers for single-business mode. Do not import from client code.
import { db } from '@/lib/db'
import { BUSINESS } from '@/lib/business'

/**
 * Resolve the Provider record that all bookings/quote requests are assigned to.
 * Prefers the provider owned by BUSINESS.ownerEmail, falls back to the first
 * active verified provider so a renamed owner account doesn't break booking.
 */
export async function getBusinessProvider() {
  const byOwner = await db.provider.findFirst({
    where: { user: { email: BUSINESS.ownerEmail } },
    include: { user: true },
  })
  if (byOwner) return byOwner

  return db.provider.findFirst({
    where: { isActive: true, profileStatus: 'verified' },
    orderBy: { createdAt: 'asc' },
    include: { user: true },
  })
}

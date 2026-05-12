import { PrismaClient } from '@prisma/client';

// ── Prisma Client Singleton ────────────────────────────────────────
// Prevents "too many connections" in dev (Next.js hot reloading).
// In production, uses a single instance.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

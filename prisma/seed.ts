// ── Seed: Single-Business Mode ───────────────────────────────────────
// Sets up the database for Terrazas Lawn Care & Tree Service:
//   1. The business owner account + verified Provider record (all bookings route here)
//   2. The platform admin account
//   3. Removes the old multi-provider marketplace demo data (@test.com accounts)
//
// Idempotent: uses upserts, safe to run repeatedly. Does NOT wipe real users.

import { PrismaClient } from '@prisma/client';
import { BUSINESS, ALL_SERVICE_ZIPS, SERVICES } from '../lib/business';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'austinapplebee@keatingtractor.com';

async function main() {
  console.log('🌱 Seeding single-business mode for', BUSINESS.name, '\n');

  // ── 1. Business owner + Provider ──────────────────────────────────
  const owner = await prisma.user.upsert({
    where: { email: BUSINESS.ownerEmail },
    update: { role: 'pro', name: 'Brandyn Terrazas' },
    create: {
      email: BUSINESS.ownerEmail,
      name: 'Brandyn Terrazas',
      role: 'pro',
      city: 'Liberal',
      state: 'KS',
      zipCode: '67901',
      onboardedAt: new Date(),
    },
  });

  const providerData = {
    businessName: BUSINESS.name,
    phone: BUSINESS.phone,
    email: BUSINESS.ownerEmail,
    isVerified: true,
    isActive: true,
    profileStatus: 'verified',
    insuranceStatus: 'verified',
    idVerified: true,
    proTier: 1, // Verified tier — no escrow holds, no job caps
    maxActiveJobs: 999,
    freeInstant: true,
    payoutHoldDays: 1,
    serviceTypes: JSON.stringify(SERVICES.map((s) => s.id)),
    zipCodes: JSON.stringify(ALL_SERVICE_ZIPS),
    latitude: 37.0439, // Liberal, KS
    longitude: -100.921,
    serviceRadiusMi: 60,
    yearsInBusiness: 15,
    teamSize: 'small',
    equipmentType: 'commercial',
    bio: `${BUSINESS.tagline}. Family-owned and operated for over ${BUSINESS.yearsInBusiness} years in Liberal, Kansas. From basic lawn maintenance and tree pruning to expert landscaping and stump grinding, our licensed and insured crew handles it all across Southwest Kansas, the Oklahoma Panhandle, and Perryton, TX.`,
  };

  const provider = await prisma.provider.upsert({
    where: { userId: owner.id },
    update: providerData,
    create: { userId: owner.id, ...providerData },
  });
  console.log(`✅ Business provider ready: ${provider.businessName} (${provider.id})`);

  // ── 2. Platform admin ──────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'admin' },
    create: { email: ADMIN_EMAIL, name: 'Austin Applebee', role: 'admin', onboardedAt: new Date() },
  });
  console.log(`✅ Admin account ready: ${ADMIN_EMAIL}`);

  // ── 3. Remove old marketplace demo data ────────────────────────────
  const testUsers = await prisma.user.findMany({
    where: { email: { endsWith: '@test.com' } },
    include: { provider: true },
  });
  if (testUsers.length > 0) {
    const userIds = testUsers.map((u) => u.id);
    const providerIds = testUsers.filter((u) => u.provider).map((u) => u.provider!.id);

    const demoJobs = await prisma.job.findMany({
      where: { OR: [{ customerId: { in: userIds } }, { providerId: { in: providerIds } }] },
      select: { id: true },
    });
    const jobIds = demoJobs.map((j) => j.id);

    // Children first (FK order), then jobs, providers, users
    await prisma.tip.deleteMany({ where: { OR: [{ jobId: { in: jobIds } }, { customerId: { in: userIds } }] } });
    await prisma.review.deleteMany({ where: { OR: [{ jobId: { in: jobIds } }, { authorId: { in: userIds } }] } });
    await prisma.message.deleteMany({ where: { OR: [{ jobId: { in: jobIds } }, { senderId: { in: userIds } }] } });
    await prisma.claim.deleteMany({ where: { OR: [{ jobId: { in: jobIds } }, { providerId: { in: providerIds } }] } });
    await prisma.veto.deleteMany({ where: { OR: [{ jobId: { in: jobIds } }, { providerId: { in: providerIds } }] } });
    await prisma.notification.deleteMany({ where: { OR: [{ jobId: { in: jobIds } }, { userId: { in: userIds } }] } });
    await prisma.subscription.deleteMany({ where: { customerId: { in: userIds } } });
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.neighborhoodAnnouncement.deleteMany({ where: { providerId: { in: providerIds } } });
    await prisma.escrowHold.deleteMany({ where: { providerId: { in: providerIds } } });
    await prisma.payoutRecord.deleteMany({ where: { providerId: { in: providerIds } } });
    await prisma.pushSubscription.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.provider.deleteMany({ where: { id: { in: providerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    console.log(`🧹 Removed ${testUsers.length} demo accounts (${providerIds.length} providers, ${jobIds.length} jobs)`);
  } else {
    console.log('🧹 No demo accounts to clean');
  }

  // Normalize any lingering legacy 'provider' roles to 'pro' (the value the app checks)
  const fixed = await prisma.user.updateMany({ where: { role: 'provider' }, data: { role: 'pro' } });
  if (fixed.count > 0) console.log(`🔧 Normalized ${fixed.count} legacy 'provider' roles to 'pro'`);

  console.log('\n🎉 Done. Every booking/quote now routes to', BUSINESS.name);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

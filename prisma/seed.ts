import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Terrazas database — Liberal, KS launch zone...\n');

  // ── Clear existing data ────────────────────────────────────────────
  await prisma.tip.deleteMany();
  await prisma.review.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.job.deleteMany();
  await prisma.yardScan.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.user.deleteMany();

  // ── Customers ──────────────────────────────────────────────────────
  const customer1 = await prisma.user.create({
    data: {
      email: 'customer@test.com',
      name: 'Jordan Rivera',
      role: 'customer',
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      email: 'maria@test.com',
      name: 'Maria Santos',
      role: 'customer',
    },
  });

  const customer3 = await prisma.user.create({
    data: {
      email: 'billy@test.com',
      name: 'Billy Hernandez',
      role: 'customer',
    },
  });

  console.log('✅ 3 customers created');

  // ── Pro Users ──────────────────────────────────────────────────────
  const proUser1 = await prisma.user.create({
    data: {
      email: 'greenscapes@test.com',
      phone: '+16205551234',
      name: 'Carlos Mendoza',
      role: 'provider',
    },
  });

  const proUser2 = await prisma.user.create({
    data: {
      email: 'prairiepro@test.com',
      phone: '+16205559876',
      name: 'Jake Whitfield',
      role: 'provider',
    },
  });

  const proUser3 = await prisma.user.create({
    data: {
      email: 'dustdevils@test.com',
      phone: '+16205555551',
      name: 'Tomás Garza',
      role: 'provider',
    },
  });

  const proUser4 = await prisma.user.create({
    data: {
      email: 'gardencitylawn@test.com',
      phone: '+16205554321',
      name: 'Sarah Mitchell',
      role: 'provider',
    },
  });

  console.log('✅ 4 pro users created');

  // ── Providers ──────────────────────────────────────────────────────
  // Liberal, KS: 37.0439, -100.9210 (zip 67901)
  // Garden City, KS: 37.9717, -100.8727 (zip 67846)
  // Dodge City, KS: 37.7528, -100.0171 (zip 67801)
  // Hugoton, KS: 37.1726, -101.3499 (zip 67951)
  // Guymon, OK: 36.6898, -101.4816 (zip 73942)

  const provider1 = await prisma.provider.create({
    data: {
      userId: proUser1.id,
      businessName: 'GreenScapes Liberal',
      phone: '+16205551234',
      email: 'greenscapes@test.com',
      rating: 4.8,
      reviewCount: 47,
      isVerified: true,
      isActive: true,
      latitude: 37.0439,
      longitude: -100.9210,
      serviceRadiusMi: 30,
      zipCodes: JSON.stringify(['67901', '67905', '67951', '67954']),
      insuranceStatus: 'verified',
      riskTier: 1,
    },
  });

  const provider2 = await prisma.provider.create({
    data: {
      userId: proUser2.id,
      businessName: 'Prairie Pro Lawn Care',
      phone: '+16205559876',
      email: 'prairiepro@test.com',
      rating: 4.5,
      reviewCount: 23,
      isVerified: true,
      isActive: true,
      latitude: 37.0600,
      longitude: -100.9400,
      serviceRadiusMi: 25,
      zipCodes: JSON.stringify(['67901', '67905', '67950', '67951']),
      insuranceStatus: 'verified',
      riskTier: 1,
    },
  });

  const provider3 = await prisma.provider.create({
    data: {
      userId: proUser3.id,
      businessName: 'Dust Devil Landscaping',
      phone: '+16205555551',
      email: 'dustdevils@test.com',
      rating: 4.9,
      reviewCount: 112,
      isVerified: true,
      isActive: true,
      latitude: 37.1726,
      longitude: -101.3499,
      serviceRadiusMi: 40,
      zipCodes: JSON.stringify(['67951', '67954', '67901', '67950']),
      insuranceStatus: 'verified',
      riskTier: 1,
    },
  });

  const provider4 = await prisma.provider.create({
    data: {
      userId: proUser4.id,
      businessName: 'Garden City Lawn Co.',
      phone: '+16205554321',
      email: 'gardencitylawn@test.com',
      rating: 4.3,
      reviewCount: 8,
      isVerified: false, // New pro, not yet verified
      isActive: false,   // Offline for testing
      latitude: 37.9717,
      longitude: -100.8727,
      serviceRadiusMi: 35,
      zipCodes: JSON.stringify(['67846', '67801', '67901']),
      insuranceStatus: 'pending',
      riskTier: 2,
    },
  });

  console.log('✅ 4 providers created (3 active, 1 offline)');

  // ── Sample Jobs ────────────────────────────────────────────────────
  const job1 = await prisma.job.create({
    data: {
      customerId: customer1.id,
      providerId: provider1.id,
      status: 'completed',
      serviceType: 'mowing',
      tier: 'premium',
      zipCode: '67901',
      address: '412 N Kansas Ave, Liberal, KS 67901',
      latitude: 37.0450,
      longitude: -100.9200,
      price: 75.0,
      claimedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 50 * 60 * 1000),
    },
  });

  const job2 = await prisma.job.create({
    data: {
      customerId: customer1.id,
      status: 'broadcast',
      serviceType: 'full_service',
      tier: 'premium',
      zipCode: '67901',
      address: '412 N Kansas Ave, Liberal, KS 67901',
      latitude: 37.0450,
      longitude: -100.9200,
      price: 120.0,
    },
  });

  const job3 = await prisma.job.create({
    data: {
      customerId: customer2.id,
      providerId: provider2.id,
      status: 'in_progress',
      serviceType: 'mowing',
      tier: 'basic',
      zipCode: '67951',
      address: '205 S Main St, Hugoton, KS 67951',
      latitude: 37.1726,
      longitude: -101.3499,
      price: 45.0,
      etaMinutes: 15,
      claimedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  });

  const job4 = await prisma.job.create({
    data: {
      customerId: customer3.id,
      status: 'broadcast',
      serviceType: 'cleanup',
      tier: 'basic',
      zipCode: '67901',
      address: '1501 W 15th St, Liberal, KS 67901',
      latitude: 37.0390,
      longitude: -100.9350,
      price: 65.0,
    },
  });

  console.log('✅ 4 jobs created (1 completed, 2 broadcast, 1 in-progress)');

  // ── Sample Review ──────────────────────────────────────────────────
  await prisma.review.create({
    data: {
      jobId: job1.id,
      authorId: customer1.id,
      providerId: provider1.id,
      rating: 5,
      comment: 'Carlos did an amazing job! Yard looks perfect. He was on time and super professional. Best lawn service in Liberal!',
    },
  });

  console.log('✅ 1 review created');

  // ── Sample Tip ─────────────────────────────────────────────────────
  await prisma.tip.create({
    data: {
      jobId: job1.id,
      customerId: customer1.id,
      providerId: provider1.id,
      amount: 15.0,
      status: 'completed',
    },
  });

  console.log('✅ 1 tip created');

  console.log('\n🎉 Seed complete! Liberal, KS launch zone ready.');
  console.log('   📍 Center: Liberal, KS 67901 (37.0439, -100.9210)');
  console.log('   📏 Radius: 120 miles');
  console.log('   👥 3 customers, 4 providers (3 active), 4 jobs');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient, Role, ActivityType, QuestStatus, PointTxType, CoinTxType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for CiDash...');

  // 1. Bersihkan data lama jika ada (urutan penghapusan sesuai relasi foreign key)
  await prisma.coinTransaction.deleteMany();
  await prisma.pointLedger.deleteMany();
  await prisma.quest.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.squadMember.deleteMany();
  await prisma.squad.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Existing data cleared.');

  // 2. Hash default password
  const passwordHash = await bcrypt.hash('password123', 10);

  // 3. Buat Pengguna Demo
  const captain = await prisma.user.create({
    data: {
      email: 'captain@cidash.id',
      passwordHash,
      name: 'Nicholas (Captain)',
      coinBalance: 250, // Saldo koin virtual
      rankPoints: 480,  // Poin peringkat kompetisi
      shieldTickets: 2, // Tiket perisai pembatal penalti
    },
  });

  const runnerBudi = await prisma.user.create({
    data: {
      email: 'budi@cidash.id',
      passwordHash,
      name: 'Budi Santoso',
      coinBalance: 120,
      rankPoints: 350,
      shieldTickets: 1,
    },
  });

  const runnerSiti = await prisma.user.create({
    data: {
      email: 'siti@cidash.id',
      passwordHash,
      name: 'Siti Rahma',
      coinBalance: 80,
      rankPoints: 420,
      shieldTickets: 0,
    },
  });

  const runnerReza = await prisma.user.create({
    data: {
      email: 'reza@cidash.id',
      passwordHash,
      name: 'Reza Pratama',
      coinBalance: 50,
      rankPoints: 290,
      shieldTickets: 1,
    },
  });

  console.log('👤 Created 4 demo users.');

  // 4. Buat Circle Privat (Squad) dengan Kode 8 Karakter Unik
  const squad = await prisma.squad.create({
    data: {
      name: 'GBK Sunset Runners',
      inviteCode: 'RUN8MORN', // 8 Karakter unik
      isPremium: true,
      createdById: captain.id,
      members: {
        create: [
          { userId: captain.id, role: Role.CAPTAIN },
          { userId: runnerBudi.id, role: Role.MEMBER },
          { userId: runnerSiti.id, role: Role.MEMBER },
          { userId: runnerReza.id, role: Role.MEMBER },
        ],
      },
    },
  });

  console.log(`🏃 Created Squad "${squad.name}" with Invite Code: ${squad.inviteCode}`);

  // 5. Buat Log Aktivitas GPS Olahraga dengan Titik Rute GeoJSON (Rute Sekitar GBK Jakarta)
  const gbkRouteGeoJson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [106.8015, -6.2185],
            [106.8028, -6.2198],
            [106.8042, -6.2212],
            [106.8055, -6.2225],
            [106.8040, -6.2238],
            [106.8020, -6.2220],
            [106.8015, -6.2185],
          ],
        },
        properties: {
          route_name: 'Looping Ring GBK Senayan',
        },
      },
    ],
  };

  const activitySiti = await prisma.activity.create({
    data: {
      userId: runnerSiti.id,
      type: ActivityType.RUNNING,
      distanceMeters: 5200.0,
      durationSeconds: 1800, // 30 menit
      averagePace: 5.76,      // 5:45 min/km
      routeGeoJson: gbkRouteGeoJson,
      startedAt: new Date(Date.now() - 3600 * 1000 * 2), // 2 jam yang lalu
      endedAt: new Date(Date.now() - 3600 * 1000 * 1.5),
    },
  });

  console.log('📍 Created GPS Activity Log for Siti.');

  // 6. Buat Quests & P2P Bomb Mission
  // Misi 1: Bomb Mission P2P Aktif dari Captain ke Budi
  const activeBombQuest = await prisma.quest.create({
    data: {
      squadId: squad.id,
      creatorId: captain.id,
      targetUserId: runnerBudi.id,
      activityType: ActivityType.RUNNING,
      targetDistance: 5000.0, // 5 KM
      targetMaxPace: 6.0,     // Maksimal pace 6:00 min/km
      stakesPoints: 50,       // Taruhan 50 Rank Points
      rewardTitle: 'Weekend 5K Challenge',
      deadline: new Date(Date.now() + 3600 * 1000 * 48), // 48 jam ke depan
      status: QuestStatus.PENDING,
    },
  });

  // Misi 2: Misi yang sudah terselesaikan oleh Siti
  const completedQuest = await prisma.quest.create({
    data: {
      squadId: squad.id,
      creatorId: captain.id,
      targetUserId: runnerSiti.id,
      activityType: ActivityType.RUNNING,
      targetDistance: 5000.0,
      targetMaxPace: 6.3,
      stakesPoints: 40,
      rewardTitle: 'GBK Sunset Sprint',
      deadline: new Date(Date.now() + 3600 * 1000 * 24),
      status: QuestStatus.COMPLETED,
      activityId: activitySiti.id,
    },
  });

  console.log('🎯 Created Quests (1 P2P Bomb Mission Pending, 1 Completed).');

  // 7. Catat Transaksi Koin Virtual (Coin Transactions)
  await prisma.coinTransaction.createMany({
    data: [
      {
        userId: captain.id,
        amount: 300,
        type: CoinTxType.TOP_UP,
        reference: 'INV-MIDTRANS-202610-001',
      },
      {
        userId: captain.id,
        amount: -50,
        type: CoinTxType.BOMB_MISSION_FEE,
        reference: `BOMB-QUEST-${activeBombQuest.id.substring(0, 8)}`,
      },
      {
        userId: runnerBudi.id,
        amount: 150,
        type: CoinTxType.TOP_UP,
        reference: 'INV-XENDIT-202610-002',
      },
    ],
  });

  // 8. Catat Point Ledger (Rank Points)
  await prisma.pointLedger.createMany({
    data: [
      {
        userId: runnerSiti.id,
        amount: 40,
        type: PointTxType.QUEST_WIN,
        reference: `WIN-QUEST-${completedQuest.id.substring(0, 8)}`,
      },
    ],
  });

  console.log('💰 Created Coin Transactions & Rank Point Ledgers.');
  console.log('✅ Database Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

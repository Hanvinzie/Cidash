import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AntiCheatService } from './services/anti-cheat.service';
import { CreateActivityDto } from './dto';
import { PointTxType, QuestStatus } from '@prisma/client';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly antiCheatService: AntiCheatService,
  ) {}

  /**
   * Menyimpan log perekaman aktivitas olahraga GPS baru.
   * Melakukan verifikasi anti-cheat otomatis, mencocokkan misi aktif,
   * serta mengalokasikan rankPoints ke pengguna.
   */
  async createActivity(userId: string, createActivityDto: CreateActivityDto) {
    const startedAt = new Date(createActivityDto.startedAt);
    const endedAt = new Date(createActivityDto.endedAt);

    if (isNaN(startedAt.getTime()) || isNaN(endedAt.getTime())) {
      throw new BadRequestException('Format waktu mulai atau selesai tidak valid');
    }

    if (endedAt <= startedAt) {
      throw new BadRequestException(
        'Waktu selesai olahraga harus lebih lambat dari waktu mulai',
      );
    }

    // 1. Validasi Anti-Cheat Otomatis (Kecepatan, Anomali Pace, Lonjakan Koordinat Haversine)
    const validation = this.antiCheatService.validateActivity(
      createActivityDto.type,
      createActivityDto.distanceMeters,
      createActivityDto.durationSeconds,
      createActivityDto.averagePace,
      createActivityDto.routeGeoJson,
    );

    // 2. Cari kandidat misi aktif yang ditugaskan kepada pengguna saat ini
    const activeQuests = await this.prisma.quest.findMany({
      where: {
        targetUserId: userId,
        status: { in: [QuestStatus.PENDING, QuestStatus.ACCEPTED] },
        deadline: { gt: startedAt },
        activityType: createActivityDto.type,
      },
      orderBy: {
        stakesPoints: 'desc', // Prioritaskan misi dengan taruhan terbesar
      },
    });

    // 3. Pencocokan Otomatis: Cari misi yang syarat jarak dan pace terpenuhi
    const matchedQuest = activeQuests.find((quest) => {
      const distanceMet =
        createActivityDto.distanceMeters >= quest.targetDistance;
      const paceMet =
        !quest.targetMaxPace ||
        createActivityDto.averagePace <= quest.targetMaxPace;
      return distanceMet && paceMet;
    });

    // 4. Hitung Poin yang Diperoleh
    // Poin dasar olahraga: 10 poin per kilometer (minimal 10 poin)
    const baseWorkoutPoints = Math.max(
      10,
      Math.floor(createActivityDto.distanceMeters / 1000) * 10,
    );
    const questBonusPoints = matchedQuest ? matchedQuest.stakesPoints : 0;
    const totalPointsGained = baseWorkoutPoints + questBonusPoints;

    // 5. Simpan Aktivitas, Perbarui Misi, dan Catat Alokasi Poin secara Atomik
    const result = await this.prisma.$transaction(async (tx) => {
      // Buat record Activity
      const activity = await tx.activity.create({
        data: {
          userId,
          type: createActivityDto.type,
          distanceMeters: createActivityDto.distanceMeters,
          durationSeconds: createActivityDto.durationSeconds,
          averagePace: createActivityDto.averagePace,
          routeGeoJson: createActivityDto.routeGeoJson,
          startedAt,
          endedAt,
        },
      });

      // Jika ada misi yang berhasil diselesaikan
      if (matchedQuest) {
        await tx.quest.update({
          where: { id: matchedQuest.id },
          data: {
            status: QuestStatus.COMPLETED,
            activityId: activity.id,
          },
        });

        // Catat mutasi perolehan poin kemenangan misi di PointLedger
        await tx.pointLedger.create({
          data: {
            userId,
            amount: questBonusPoints,
            type: PointTxType.QUEST_WIN,
            reference: `QUEST-COMPLETED-${matchedQuest.id.substring(0, 8)}`,
          },
        });
      }

      // Catat mutasi poin dasar olahraga di PointLedger
      await tx.pointLedger.create({
        data: {
          userId,
          amount: baseWorkoutPoints,
          type: PointTxType.ACTIVITY_REWARD,
          reference: `WORKOUT-${activity.id.substring(0, 8)}`,
        },
      });

      // Tambahkan seluruh akumulasi poin ke akun pengguna
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          rankPoints: { increment: totalPointsGained },
        },
        select: {
          id: true,
          rankPoints: true,
        },
      });

      return {
        activity,
        updatedRankPoints: updatedUser.rankPoints,
      };
    });

    return {
      message: matchedQuest
        ? 'Aktivitas olahraga berhasil disimpan dan Misi Tantangan telah diselesaikan!'
        : 'Aktivitas olahraga berhasil disimpan dan terverifikasi.',
      antiCheatVerification: {
        passed: true,
        calculatedRouteDistanceMeters: validation.calculatedDistanceMeters,
        averageSpeedMps: validation.averageSpeedMps,
      },
      rewards: {
        baseWorkoutPoints,
        questBonusPoints,
        totalPointsGained,
        currentRankPoints: result.updatedRankPoints,
      },
      questCompleted: matchedQuest
        ? {
            id: matchedQuest.id,
            rewardTitle: matchedQuest.rewardTitle,
            stakesPoints: matchedQuest.stakesPoints,
          }
        : null,
      activity: result.activity,
    };
  }

  /**
   * Mengambil riwayat seluruh rekaman olahraga pengguna lampau dengan agregasi metrik.
   */
  async getHistory(userId: string, page = 1, limit = 10) {
    const pageNumber = Math.max(1, Number(page));
    const pageSize = Math.max(1, Math.min(50, Number(limit)));
    const skip = (pageNumber - 1) * pageSize;

    const [activities, totalCount, aggregate] = await Promise.all([
      this.prisma.activity.findMany({
        where: { userId },
        include: {
          questMatches: {
            select: {
              id: true,
              rewardTitle: true,
              stakesPoints: true,
              status: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.activity.count({ where: { userId } }),
      this.prisma.activity.aggregate({
        where: { userId },
        _sum: {
          distanceMeters: true,
          durationSeconds: true,
        },
      }),
    ]);

    const totalDistanceMeters = aggregate._sum.distanceMeters ?? 0;
    const totalDurationSeconds = aggregate._sum.durationSeconds ?? 0;

    return {
      summary: {
        totalWorkouts: totalCount,
        totalDistanceMeters,
        totalDistanceKilometers:
          Math.round((totalDistanceMeters / 1000) * 100) / 100,
        totalDurationMinutes: Math.round(totalDurationSeconds / 60),
      },
      pagination: {
        currentPage: pageNumber,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
      activities: activities.map((item) => ({
        id: item.id,
        type: item.type,
        distanceMeters: item.distanceMeters,
        distanceKilometers:
          Math.round((item.distanceMeters / 1000) * 100) / 100,
        durationSeconds: item.durationSeconds,
        averagePace: item.averagePace,
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        completedQuest: item.questMatches[0] ?? null,
      })),
    };
  }

  /**
   * Mengambil detail spesifik satu aktivitas lengkap dengan data GeoJSON rute.
   */
  async getActivityDetail(activityId: string, userId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        user: { select: { id: true, name: true } },
        questMatches: true,
      },
    });

    if (!activity) {
      throw new NotFoundException('Data aktivitas tidak ditemukan');
    }

    if (activity.userId !== userId) {
      throw new ForbiddenException(
        'Akses ditolak. Anda tidak berhak melihat aktivitas pengguna lain',
      );
    }

    return activity;
  }
}

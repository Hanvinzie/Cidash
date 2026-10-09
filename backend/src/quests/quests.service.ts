import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { CreateQuestDto } from './dto';
import { CoinTxType, PointTxType, QuestStatus } from '@prisma/client';

export const BOMB_MISSION_FEE = 20;

@Injectable()
export class QuestsService {
  private readonly logger = new Logger(QuestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mengirimkan Bomb Mission P2P ke teman satu Circle.
   * Dikenakan biaya koin virtual yang dipotong dari saldo pembuat.
   */
  async createQuest(creatorId: string, createQuestDto: CreateQuestDto) {
    if (creatorId === createQuestDto.targetUserId) {
      throw new BadRequestException(
        'Anda tidak dapat mengirimkan Bomb Mission kepada diri sendiri',
      );
    }

    const deadlineDate = new Date(createQuestDto.deadline);
    if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
      throw new BadRequestException(
        'Deadline misi harus berupa waktu di masa depan',
      );
    }

    // Verifikasi bahwa pembuat dan target sama-sama merupakan anggota circle yang dituju
    const [creatorMember, targetMember] = await Promise.all([
      this.prisma.squadMember.findUnique({
        where: {
          squadId_userId: {
            squadId: createQuestDto.squadId,
            userId: creatorId,
          },
        },
      }),
      this.prisma.squadMember.findUnique({
        where: {
          squadId_userId: {
            squadId: createQuestDto.squadId,
            userId: createQuestDto.targetUserId,
          },
        },
      }),
    ]);

    if (!creatorMember) {
      throw new ForbiddenException(
        'Akses ditolak. Anda bukan anggota Circle ini',
      );
    }

    if (!targetMember) {
      throw new BadRequestException(
        'Target pengguna yang dituju bukan anggota dari Circle ini',
      );
    }

    // Validasi kecukupan saldo koin pembuat misi
    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, coinBalance: true, name: true },
    });

    if (!creator || creator.coinBalance < BOMB_MISSION_FEE) {
      throw new BadRequestException(
        `Saldo koin tidak mencukupi. Diperlukan ${BOMB_MISSION_FEE} koin untuk mengirimkan Bomb Mission. Saldo saat ini: ${creator?.coinBalance ?? 0} koin.`,
      );
    }

    // Eksekusi transaksi atomik pemotongan koin, pencatatan mutasi koin, dan pembuatan misi
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Potong saldo koin pembuat
      const updatedCreator = await tx.user.update({
        where: { id: creatorId },
        data: {
          coinBalance: { decrement: BOMB_MISSION_FEE },
        },
        select: { coinBalance: true },
      });

      // 2. Buat record Quest
      const quest = await tx.quest.create({
        data: {
          squadId: createQuestDto.squadId,
          creatorId,
          targetUserId: createQuestDto.targetUserId,
          activityType: createQuestDto.activityType,
          targetDistance: createQuestDto.targetDistance,
          targetMaxPace: createQuestDto.targetMaxPace,
          stakesPoints: createQuestDto.stakesPoints,
          rewardTitle: createQuestDto.rewardTitle ?? 'P2P Bomb Mission',
          deadline: deadlineDate,
          status: QuestStatus.PENDING,
        },
        include: {
          squad: { select: { id: true, name: true } },
          targetUser: { select: { id: true, name: true, email: true } },
        },
      });

      // 3. Catat riwayat mutasi koin
      await tx.coinTransaction.create({
        data: {
          userId: creatorId,
          amount: -BOMB_MISSION_FEE,
          type: CoinTxType.BOMB_MISSION_FEE,
          reference: `BOMB-${quest.id.substring(0, 8)}`,
        },
      });

      return { quest, remainingCoinBalance: updatedCreator.coinBalance };
    });

    return {
      message: 'Bomb Mission berhasil dikirimkan ke teman satu Circle',
      cost: BOMB_MISSION_FEE,
      remainingCoinBalance: result.remainingCoinBalance,
      quest: result.quest,
    };
  }

  /**
   * Menampilkan semua misi aktif (PENDING atau ACCEPTED) dari circle yang diikuti pengguna.
   */
  async getActiveQuests(userId: string, squadId?: string) {
    // Cari seluruh circle yang diikuti oleh pengguna
    const userMemberships = await this.prisma.squadMember.findMany({
      where: { userId },
      select: { squadId: true },
    });

    const userSquadIds = userMemberships.map((m) => m.squadId);

    if (userSquadIds.length === 0) {
      return { total: 0, quests: [] };
    }

    const targetSquadIds = squadId ? [squadId] : userSquadIds;

    // Filter hanya squad yang pengguna memang terdaftar di dalamnya
    const validSquadIds = targetSquadIds.filter((id) =>
      userSquadIds.includes(id),
    );

    if (validSquadIds.length === 0) {
      throw new ForbiddenException(
        'Akses ditolak. Anda bukan anggota dari Circle yang dipilih',
      );
    }

    const now = new Date();

    const quests = await this.prisma.quest.findMany({
      where: {
        squadId: { in: validSquadIds },
        status: { in: [QuestStatus.PENDING, QuestStatus.ACCEPTED] },
        deadline: { gt: now },
      },
      include: {
        creator: {
          select: { id: true, name: true },
        },
        targetUser: {
          select: { id: true, name: true },
        },
        squad: {
          select: { id: true, name: true, inviteCode: true },
        },
      },
      orderBy: {
        deadline: 'asc',
      },
    });

    const formattedQuests = quests.map((quest) => {
      const remainingSeconds = Math.max(
        0,
        Math.floor((quest.deadline.getTime() - now.getTime()) / 1000),
      );

      return {
        id: quest.id,
        rewardTitle: quest.rewardTitle,
        activityType: quest.activityType,
        targetDistance: quest.targetDistance,
        targetMaxPace: quest.targetMaxPace,
        stakesPoints: quest.stakesPoints,
        status: quest.status,
        deadline: quest.deadline,
        remainingSeconds,
        squad: quest.squad,
        creator: quest.creator,
        targetUser: quest.targetUser,
        isTargetUser: quest.targetUserId === userId,
        isCreator: quest.creatorId === userId,
      };
    });

    return {
      total: formattedQuests.length,
      quests: formattedQuests,
    };
  }

  /**
   * Menggunakan Shield Ticket untuk membatalkan penalti dari misi aktif.
   */
  async useShieldTicket(questId: string, userId: string) {
    const quest = await this.prisma.quest.findUnique({
      where: { id: questId },
      include: {
        creator: { select: { id: true, name: true } },
      },
    });

    if (!quest) {
      throw new NotFoundException('Misi tidak ditemukan');
    }

    if (quest.targetUserId !== userId) {
      throw new ForbiddenException(
        'Hanya target penerima tantangan yang berhak menggunakan Shield Ticket untuk misi ini',
      );
    }

    if (
      quest.status !== QuestStatus.PENDING &&
      quest.status !== QuestStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        `Shield Ticket tidak dapat digunakan karena misi telah berstatus ${quest.status}`,
      );
    }

    if (quest.deadline <= new Date()) {
      throw new BadRequestException(
        'Misi sudah melewati batas waktu dan tidak dapat diproteksi',
      );
    }

    // Periksa ketersediaan tiket perisai target user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { shieldTickets: true },
    });

    if (!user || user.shieldTickets < 1) {
      throw new BadRequestException(
        'Anda tidak memiliki Shield Ticket yang dapat digunakan',
      );
    }

    // Transaksi atomik pengurangan 1 shield ticket dan pembaruan status misi menjadi SHIELDED
    const updatedQuest = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          shieldTickets: { decrement: 1 },
        },
      });

      return tx.quest.update({
        where: { id: questId },
        data: {
          status: QuestStatus.SHIELDED,
        },
      });
    });

    return {
      message:
        'Shield Ticket berhasil digunakan. Pinalti poin dan status misi telah dinetralkan.',
      questId: updatedQuest.id,
      status: updatedQuest.status,
    };
  }

  /**
   * Menerima tantangan misi (mengubah status dari PENDING menjadi ACCEPTED).
   */
  async acceptQuest(questId: string, userId: string) {
    const quest = await this.prisma.quest.findUnique({
      where: { id: questId },
    });

    if (!quest) {
      throw new NotFoundException('Misi tidak ditemukan');
    }

    if (quest.targetUserId !== userId) {
      throw new ForbiddenException(
        'Hanya target penerima tantangan yang dapat menerima misi ini',
      );
    }

    if (quest.status !== QuestStatus.PENDING) {
      throw new BadRequestException(
        `Misi tidak dapat diterima karena saat ini berstatus ${quest.status}`,
      );
    }

    if (quest.deadline <= new Date()) {
      throw new BadRequestException(
        'Misi telah melewati batas waktu dan tidak dapat diterima',
      );
    }

    const updated = await this.prisma.quest.update({
      where: { id: questId },
      data: { status: QuestStatus.ACCEPTED },
    });

    return {
      message: 'Misi berhasil diterima',
      quest: updated,
    };
  }

  /**
   * Mengambil detail spesifik dari suatu misi.
   */
  async getQuestDetail(questId: string, userId: string) {
    const quest = await this.prisma.quest.findUnique({
      where: { id: questId },
      include: {
        squad: { select: { id: true, name: true, inviteCode: true } },
        creator: { select: { id: true, name: true, email: true } },
        targetUser: { select: { id: true, name: true, email: true } },
      },
    });

    if (!quest) {
      throw new NotFoundException('Misi tidak ditemukan');
    }

    const isMember = await this.prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId: quest.squadId,
          userId,
        },
      },
    });

    if (!isMember) {
      throw new ForbiddenException(
        'Akses ditolak. Anda bukan anggota dari Circle tempat misi ini berlangsung',
      );
    }

    return quest;
  }

  /**
   * Cron Job Auto-Expire: Berjalan setiap jam secara otomatis.
   * Mendeteksi seluruh misi PENDING/ACCEPTED yang melampaui deadline,
   * mengubah status menjadi FAILED, memotong penalti rankPoints target user,
   * memberikan reward rankPoints kepada creator, dan mencatat mutasi di PointLedger.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoExpireCron() {
    this.logger.log('Menjalankan pengecekan otomatis misi kedaluwarsa...');
    const result = await this.expireOverdueQuests();
    this.logger.log(
      `Pengecekan selesai. Sebanyak ${result.expiredCount} misi kedaluwarsa diproses.`,
    );
  }

  /**
   * Logika pemrosesan misi kedaluwarsa (dapat dipanggil otomatis via cron atau manual).
   */
  async expireOverdueQuests() {
    const now = new Date();

    const overdueQuests = await this.prisma.quest.findMany({
      where: {
        status: { in: [QuestStatus.PENDING, QuestStatus.ACCEPTED] },
        deadline: { lte: now },
      },
      include: {
        creator: { select: { id: true, rankPoints: true } },
        targetUser: { select: { id: true, rankPoints: true } },
      },
    });

    if (overdueQuests.length === 0) {
      return { expiredCount: 0 };
    }

    let processedCount = 0;

    for (const quest of overdueQuests) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // 1. Ubah status misi menjadi FAILED
          await tx.quest.update({
            where: { id: quest.id },
            data: { status: QuestStatus.FAILED },
          });

          // 2. Potong poin penalti target pengguna
          const penaltyAmount = Math.min(
            quest.targetUser.rankPoints,
            quest.stakesPoints,
          );

          if (penaltyAmount > 0) {
            await tx.user.update({
              where: { id: quest.targetUserId },
              data: {
                rankPoints: { decrement: penaltyAmount },
              },
            });

            await tx.pointLedger.create({
              data: {
                userId: quest.targetUserId,
                amount: -penaltyAmount,
                type: PointTxType.QUEST_PENALTY,
                reference: `PENALTY-${quest.id.substring(0, 8)}`,
              },
            });
          }

          // 3. Tambahkan poin kemenangan untuk pembuat misi
          await tx.user.update({
            where: { id: quest.creatorId },
            data: {
              rankPoints: { increment: quest.stakesPoints },
            },
          });

          await tx.pointLedger.create({
            data: {
              userId: quest.creatorId,
              amount: quest.stakesPoints,
              type: PointTxType.QUEST_WIN,
              reference: `WIN-${quest.id.substring(0, 8)}`,
            },
          });
        });

        processedCount++;
      } catch (error) {
        this.logger.error(
          `Gagal memproses misi kedaluwarsa id ${quest.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return { expiredCount: processedCount };
  }
}

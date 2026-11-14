import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import {
  invalidateSquadCache,
  invalidateUserCache,
} from '../common/cache/memory-cache';
import { CreateQuestDto } from './dto';
import { CoinTxType, PointTxType, QuestStatus } from '@prisma/client';

export const BOMB_MISSION_FEE = 20;
export const SNOOZE_MISSION_FEE = 10;
export const SNOOZE_DURATION_HOURS = 12;

@Injectable()
export class QuestsService {
  private readonly logger = new Logger(QuestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Memeriksa apakah pengguna sedang berada dalam Rest Mode aktif (24 jam).
   * Menggunakan `select: { reference: true }` agar PostgreSQL mengeksekusi Index-Only Scan.
   */
  private async isUserResting(userId: string): Promise<boolean> {
    if (!this.prisma.coinTransaction?.findMany) return false;
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
    const txs =
      (await this.prisma.coinTransaction.findMany({
        where: {
          userId,
          createdAt: { gte: dayAgo },
        },
        orderBy: { createdAt: 'desc' },
        select: { reference: true },
      })) ?? [];

    const latestRest = txs.find(
      (tx) =>
        tx.reference?.startsWith('REST-ACTIVE:') ||
        tx.reference?.startsWith('REST-END:'),
    );
    if (latestRest?.reference?.startsWith('REST-ACTIVE:')) {
      const exp = new Date(latestRest.reference.slice('REST-ACTIVE:'.length));
      return !isNaN(exp.getTime()) && exp > now;
    }
    return false;
  }

  /**
   * Mengirimkan Bomb Mission P2P ke teman satu Circle.
   * Dikenakan biaya koin virtual yang dipotong dari saldo pembuat.
   * Dilengkapi proteksi anti-spam:
   * - Pengirim tidak boleh sedang dalam Rest Mode
   * - Target tidak boleh sedang dalam Rest Mode
   * - Target maksimal hanya boleh memiliki 1 Bomb Mission aktif pada satu waktu (IN_MISSION)
   */
  async createQuest(creatorId: string, createQuestDto: CreateQuestDto) {
    if (creatorId === createQuestDto.targetUserId) {
      throw new BadRequestException(
        'Anda tidak dapat mengirimkan Bomb Mission kepada diri sendiri',
      );
    }

    const now = new Date();
    const deadlineDate = new Date(createQuestDto.deadline);
    if (isNaN(deadlineDate.getTime()) || deadlineDate <= now) {
      throw new BadRequestException(
        'Deadline misi harus berupa waktu di masa depan',
      );
    }

    const missionFee = createQuestDto.wagerCoins ?? BOMB_MISSION_FEE;

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

    // Cek status Rest Mode pengirim & penerima serta antrean misi aktif target secara paralel
    const [creatorResting, targetResting, targetActiveQuests] =
      await Promise.all([
        this.isUserResting(creatorId),
        this.isUserResting(createQuestDto.targetUserId),
        this.prisma.quest?.findMany
          ? this.prisma.quest.findMany({
              where: {
                targetUserId: createQuestDto.targetUserId,
                status: { in: [QuestStatus.PENDING, QuestStatus.ACCEPTED] },
                deadline: { gt: now },
              },
              select: { id: true },
            })
          : Promise.resolve([]),
      ]);

    if (creatorResting) {
      throw new BadRequestException(
        'Anda sedang berada dalam Rest Mode. Ubah status menjadi Ready terlebih dahulu untuk mengirim Bomb Mission.',
      );
    }

    if (targetResting) {
      throw new BadRequestException(
        'Target pengguna sedang berada dalam Rest Mode (Unavailable) dan tidak dapat menerima Bomb Mission saat ini.',
      );
    }

    if ((targetActiveQuests ?? []).length >= 1) {
      throw new BadRequestException(
        'Target pengguna sedang fokus menyelesaikan Bomb Mission aktif lainnya (maksimal 1 misi aktif per pengguna agar tidak spam).',
      );
    }

    // Validasi kecukupan saldo koin pembuat misi
    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, coinBalance: true, name: true },
    });

    if (!creator || creator.coinBalance < missionFee) {
      throw new BadRequestException(
        `Saldo koin tidak mencukupi. Diperlukan ${missionFee} koin untuk mengirimkan Bomb Mission. Saldo saat ini: ${creator?.coinBalance ?? 0} koin.`,
      );
    }

    // Eksekusi transaksi atomik pemotongan koin, pencatatan mutasi koin, dan pembuatan misi
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Potong saldo koin pembuat dan pastikan tidak menjadi negatif akibat race condition
      const updatedCreator = await tx.user.update({
        where: { id: creatorId },
        data: {
          coinBalance: { decrement: missionFee },
        },
        select: { coinBalance: true },
      });

      if (updatedCreator.coinBalance < 0) {
        throw new BadRequestException(
          'Saldo koin tidak mencukupi untuk menyelesaikan transaksi ini.',
        );
      }

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
          targetUser: { select: { id: true, name: true } },
        },
      });

      // 3. Catat riwayat mutasi koin
      await tx.coinTransaction.create({
        data: {
          userId: creatorId,
          amount: -missionFee,
          type: CoinTxType.BOMB_MISSION_FEE,
          reference: `BOMB-${quest.id.substring(0, 8)}`,
        },
      });

      return { quest, remainingCoinBalance: updatedCreator.coinBalance };
    });

    invalidateUserCache(creatorId);
    invalidateUserCache(createQuestDto.targetUserId);
    invalidateSquadCache(createQuestDto.squadId);

    return {
      message: 'Bomb Mission berhasil dikirimkan ke teman satu Circle',
      cost: missionFee,
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

    const snoozeRefs = quests.map((q) => `SNOOZE-${q.id.substring(0, 8)}`);
    const snoozeTxs =
      snoozeRefs.length > 0 && this.prisma.coinTransaction?.findMany
        ? ((await this.prisma.coinTransaction.findMany({
            where: { reference: { in: snoozeRefs } },
            select: { reference: true },
          })) ?? [])
        : [];
    const snoozedSet = new Set(
      snoozeTxs.map((t) => t.reference).filter(Boolean),
    );

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
        snoozed: snoozedSet.has(`SNOOZE-${quest.id.substring(0, 8)}`),
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
   * Jika misi masih berstatus PENDING saat di-shield, 50% koin taruhan dikembalikan (REFUND)
   * ke pembuat tantangan agar tetap adil bagi kedua belah pihak.
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

    const wasPending = quest.status === QuestStatus.PENDING;
    const estWager = Math.max(5, Math.round((quest.stakesPoints ?? 40) / 2));
    const senderRefundCoins = wasPending ? Math.floor(estWager / 2) : 0;

    // Transaksi atomik pengurangan 1 shield ticket, status SHIELDED, dan refund 50% koin ke pengirim
    const updatedQuest = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          shieldTickets: { decrement: 1 },
        },
        select: { shieldTickets: true },
      });

      if (updatedUser.shieldTickets < 0) {
        throw new BadRequestException(
          'Anda tidak memiliki Shield Ticket yang dapat digunakan',
        );
      }

      const q = await tx.quest.update({
        where: { id: questId },
        data: {
          status: QuestStatus.SHIELDED,
        },
      });

      if (senderRefundCoins > 0 && quest.creatorId) {
        await tx.user.update({
          where: { id: quest.creatorId },
          data: { coinBalance: { increment: senderRefundCoins } },
        });

        await tx.coinTransaction.create({
          data: {
            userId: quest.creatorId,
            amount: senderRefundCoins,
            type: CoinTxType.REFUND,
            reference: `SHIELD-REFUND-${questId.substring(0, 8)}`,
          },
        });
      }

      return q;
    });

    invalidateUserCache(userId);
    if (quest.creatorId) {
      invalidateUserCache(quest.creatorId);
    }
    if (quest.squadId) {
      invalidateSquadCache(quest.squadId);
    }

    return {
      message:
        senderRefundCoins > 0
          ? `Shield Ticket berhasil digunakan. Pinalti poin dinetralkan & ${senderRefundCoins} koin (50%) dikembalikan ke pengirim.`
          : 'Shield Ticket berhasil digunakan. Pinalti poin dan status misi telah dinetralkan.',
      questId: updatedQuest.id,
      status: updatedQuest.status,
      shielded: true,
      senderRefundCoins,
    };
  }

  /**
   * Memperpanjang tenggat waktu (Snooze) Bomb Mission sebesar +12 jam dengan biaya 10 koin.
   * Hanya dapat digunakan 1x per misi agar pengguna yang sedang sibuk tetap bisa menyelesaikan olahraga nanti.
   */
  async snoozeQuest(questId: string, userId: string) {
    const quest = await this.prisma.quest.findUnique({
      where: { id: questId },
    });

    if (!quest) {
      throw new NotFoundException('Misi tidak ditemukan');
    }

    if (quest.targetUserId !== userId) {
      throw new ForbiddenException(
        'Hanya penerima tantangan yang dapat memperpanjang tenggat waktu misi ini',
      );
    }

    if (
      quest.status !== QuestStatus.PENDING &&
      quest.status !== QuestStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        `Tenggat waktu tidak dapat diperpanjang karena misi berstatus ${quest.status}`,
      );
    }

    if (quest.deadline <= new Date()) {
      throw new BadRequestException(
        'Misi sudah melewati batas waktu dan tidak dapat diperpanjang',
      );
    }

    const snoozeRef = `SNOOZE-${quest.id.substring(0, 8)}`;
    const [existingSnooze, user] = await Promise.all([
      this.prisma.coinTransaction?.findFirst
        ? this.prisma.coinTransaction.findFirst({
            where: { userId, reference: snoozeRef },
            select: { id: true },
          })
        : Promise.resolve(null),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, coinBalance: true },
      }),
    ]);

    if (existingSnooze) {
      throw new BadRequestException(
        'Perpanjangan waktu (+12 jam) hanya dapat digunakan maksimal 1 kali untuk setiap Bomb Mission.',
      );
    }

    if (!user || user.coinBalance < SNOOZE_MISSION_FEE) {
      throw new BadRequestException(
        `Saldo koin tidak mencukupi. Diperlukan ${SNOOZE_MISSION_FEE} koin untuk memperpanjang deadline +${SNOOZE_DURATION_HOURS} jam.`,
      );
    }

    const newDeadline = new Date(
      quest.deadline.getTime() + SNOOZE_DURATION_HOURS * 3600 * 1000,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { coinBalance: { decrement: SNOOZE_MISSION_FEE } },
        select: { coinBalance: true },
      });

      if (updatedUser.coinBalance < 0) {
        throw new BadRequestException('Saldo koin tidak mencukupi');
      }

      const updatedQuest = await tx.quest.update({
        where: { id: quest.id },
        data: { deadline: newDeadline },
      });

      await tx.coinTransaction.create({
        data: {
          userId,
          amount: -SNOOZE_MISSION_FEE,
          type: CoinTxType.BOMB_MISSION_FEE,
          reference: snoozeRef,
        },
      });

      return {
        quest: updatedQuest,
        remainingCoinBalance: updatedUser.coinBalance,
      };
    });

    invalidateUserCache(userId);
    if (quest.squadId) {
      invalidateSquadCache(quest.squadId);
    }

    return {
      message: `Deadline misi berhasil diperpanjang +${SNOOZE_DURATION_HOURS} jam (${SNOOZE_MISSION_FEE} koin)`,
      cost: SNOOZE_MISSION_FEE,
      remainingCoinBalance: result.remainingCoinBalance,
      deadline: result.quest.deadline,
      snoozed: true,
    };
  }

  /**
   * Menolak tantangan misi (menggunakan Shield Ticket jika ada, atau FAILED dengan penalti).
   */
  async rejectQuest(questId: string, userId: string) {
    const quest = await this.prisma.quest.findUnique({
      where: { id: questId },
      include: {
        targetUser: {
          select: { id: true, rankPoints: true, shieldTickets: true },
        },
      },
    });

    if (!quest) {
      throw new NotFoundException('Misi tidak ditemukan');
    }

    if (quest.targetUserId !== userId) {
      throw new ForbiddenException(
        'Hanya target penerima tantangan yang dapat menolak misi ini',
      );
    }

    if (
      quest.status !== QuestStatus.PENDING &&
      quest.status !== QuestStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        `Misi tidak dapat ditolak karena berstatus ${quest.status}`,
      );
    }

    if (quest.targetUser.shieldTickets >= 1) {
      return this.useShieldTicket(questId, userId);
    }

    const penaltyAmount = Math.min(
      quest.targetUser.rankPoints,
      quest.stakesPoints,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const q = await tx.quest.update({
        where: { id: quest.id },
        data: { status: QuestStatus.FAILED },
      });

      if (penaltyAmount > 0) {
        await tx.user.update({
          where: { id: quest.targetUserId },
          data: { rankPoints: { decrement: penaltyAmount } },
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

      await tx.user.update({
        where: { id: quest.creatorId },
        data: { rankPoints: { increment: quest.stakesPoints } },
      });

      await tx.pointLedger.create({
        data: {
          userId: quest.creatorId,
          amount: quest.stakesPoints,
          type: PointTxType.QUEST_WIN,
          reference: `WIN-${quest.id.substring(0, 8)}`,
        },
      });

      return q;
    });

    invalidateUserCache(quest.targetUserId);
    invalidateUserCache(quest.creatorId);
    invalidateSquadCache(quest.squadId);

    return {
      message: 'Misi ditolak',
      questId: updated.id,
      status: updated.status,
      penaltyPoints: penaltyAmount,
      shielded: false,
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

    invalidateSquadCache(quest.squadId);

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
        creator: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true } },
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
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoExpireCron() {
    if (!this.prisma.isConnected) {
      return;
    }
    try {
      this.logger.log('Menjalankan pengecekan otomatis misi kedaluwarsa...');
      const result = await this.expireOverdueQuests();
      this.logger.log(
        `Pengecekan selesai. Sebanyak ${result.expiredCount} misi kedaluwarsa diproses.`,
      );
    } catch (error) {
      this.logger.warn(
        `Pengecekan cron dilewati karena kendala database: ${error instanceof Error ? error.message : error}`,
      );
    }
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
      take: 100,
    });

    if (overdueQuests.length === 0) {
      return { expiredCount: 0 };
    }

    let processedCount = 0;

    for (const quest of overdueQuests) {
      try {
        const didProcess = await this.prisma.$transaction(async (tx) => {
          // 1. Optimistic concurrency check (Compare-And-Swap) agar aman dijalankan pada banyak instance server
          if (tx.quest.updateMany) {
            const claimed = await tx.quest.updateMany({
              where: {
                id: quest.id,
                status: { in: [QuestStatus.PENDING, QuestStatus.ACCEPTED] },
              },
              data: { status: QuestStatus.FAILED },
            });
            if (claimed.count === 0) {
              return false;
            }
          } else {
            await tx.quest.update({
              where: { id: quest.id },
              data: { status: QuestStatus.FAILED },
            });
          }

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

          return true;
        });

        if (didProcess) {
          processedCount++;
          invalidateUserCache(quest.targetUserId);
          invalidateUserCache(quest.creatorId);
          invalidateSquadCache(quest.squadId);
        }
      } catch (error) {
        this.logger.error(
          `Gagal memproses misi kedaluwarsa id ${quest.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return { expiredCount: processedCount };
  }
}

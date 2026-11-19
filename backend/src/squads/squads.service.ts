import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  appMemoryCache,
  invalidateSquadCache,
  invalidateUserCache,
  LEADERBOARD_CACHE_TTL_MS,
} from '../common/cache/memory-cache';
import { CreateSquadDto, JoinSquadDto } from './dto';
import { ActivityStatus, CoinTxType, QuestStatus, Role } from '@prisma/client';
import * as crypto from 'crypto';

export const FREE_SQUAD_MAX_MEMBERS = 5;
export const PREMIUM_SQUAD_MAX_MEMBERS = 25;
export const PREMIUM_SQUAD_UPGRADE_COINS = 100;

interface CachedLeaderboardPayload {
  squad: {
    id: string;
    name: string;
    inviteCode: string;
    isPremium: boolean;
    maxMembers: number;
  };
  totalMembers: number;
  maxMembers: number;
  memberIds: Set<string>;
  entries: Array<{
    rank: number;
    userId: string;
    name: string;
    rankPoints: number;
    shieldTickets: number;
    totalDistanceKm: number;
    role: Role;
    joinedAt: Date;
    availabilityStatus: 'AVAILABLE' | 'IN_MISSION' | 'RESTING';
    restUntil: string | null;
  }>;
}

@Injectable()
export class SquadsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Menghitung batas maksimal kapasitas anggota berdasarkan tier Circle.
   * - Free Tier: Maksimal 5 anggota
   * - Premium Tier: Maksimal 25 anggota (batas aman beban realtime GPS & query leaderboard)
   */
  getMaxMembers(isPremium: boolean): number {
    return isPremium ? PREMIUM_SQUAD_MAX_MEMBERS : FREE_SQUAD_MAX_MEMBERS;
  }

  /**
   * Menghasilkan kode unik 8 karakter alfanumerik.
   * Karakter ambigu dihindari untuk kemudahan pembacaan pengguna.
   */
  private generateRandomCode(length = 8): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(length);
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  /**
   * Menghasilkan kode undangan 8 karakter yang terjamin unik di database.
   */
  async generateUniqueInviteCode(): Promise<string> {
    const maxRetries = 10;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const candidateCode = this.generateRandomCode(8);
      const existing = await this.prisma.squad.findUnique({
        where: { inviteCode: candidateCode },
        select: { id: true },
      });
      if (!existing) {
        return candidateCode;
      }
    }
    throw new ConflictException(
      'Gagal menghasilkan kode unik circle. Silakan coba kembali.',
    );
  }

  /**
   * Membuat Circle baru dan otomatis menetapkan pembuat sebagai CAPTAIN.
   */
  async createSquad(userId: string, createSquadDto: CreateSquadDto) {
    const inviteCode = await this.generateUniqueInviteCode();
    const wantPremium = Boolean(createSquadDto.isPremium);

    if (wantPremium && this.prisma.user?.findUnique) {
      const creator = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { coinBalance: true },
      });
      if (!creator || creator.coinBalance < PREMIUM_SQUAD_UPGRADE_COINS) {
        throw new BadRequestException(
          `Saldo koin tidak mencukupi untuk membuat Circle Premium (${PREMIUM_SQUAD_UPGRADE_COINS} koin).`,
        );
      }
    }

    const squad = await this.prisma.$transaction(async (tx) => {
      if (wantPremium && tx.user?.update) {
        await tx.user.update({
          where: { id: userId },
          data: { coinBalance: { decrement: PREMIUM_SQUAD_UPGRADE_COINS } },
        });
      }

      const newSquad = await tx.squad.create({
        data: {
          name: createSquadDto.name.trim(),
          inviteCode,
          isPremium: wantPremium,
          createdById: userId,
        },
      });

      await tx.squadMember.create({
        data: {
          squadId: newSquad.id,
          userId,
          role: Role.CAPTAIN,
        },
      });

      if (wantPremium && tx.coinTransaction?.create) {
        await tx.coinTransaction.create({
          data: {
            userId,
            amount: -PREMIUM_SQUAD_UPGRADE_COINS,
            type: CoinTxType.BOMB_MISSION_FEE,
            reference: `SQUAD-PREMIUM-${newSquad.id.substring(0, 8)}`,
          },
        });
      }

      return newSquad;
    });

    if (wantPremium) {
      invalidateUserCache(userId);
    }

    return {
      message: 'Circle berhasil dibuat',
      squad: {
        id: squad.id,
        name: squad.name,
        inviteCode: squad.inviteCode,
        isPremium: squad.isPremium,
        createdAt: squad.createdAt,
        role: Role.CAPTAIN,
        totalMembers: 1,
        maxMembers: this.getMaxMembers(squad.isPremium),
      },
    };
  }

  /**
   * Bergabung ke Circle menggunakan kode unik 8 karakter.
   * Memvalidasi batas kapasitas anggota:
   * - Free Circle: maksimal 5 anggota
   * - Premium Circle: maksimal 25 anggota (batas aman performa realtime & server)
   */
  async joinSquad(userId: string, joinSquadDto: JoinSquadDto) {
    const normalizedCode = joinSquadDto.inviteCode.trim().toUpperCase();

    const squad = await this.prisma.squad.findUnique({
      where: { inviteCode: normalizedCode },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!squad) {
      throw new NotFoundException(
        'Circle dengan kode undangan tersebut tidak ditemukan',
      );
    }

    const existingMember = await this.prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId: squad.id,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException('Anda sudah bergabung dalam Circle ini');
    }

    const maxMembers = this.getMaxMembers(squad.isPremium);
    const currentMembers = squad._count?.members ?? 0;

    if (currentMembers >= maxMembers) {
      if (!squad.isPremium) {
        throw new BadRequestException(
          `Circle Free "${squad.name}" sudah penuh (${currentMembers}/${FREE_SQUAD_MAX_MEMBERS} anggota). Upgrade Circle ke Premium untuk membuka kapasitas hingga ${PREMIUM_SQUAD_MAX_MEMBERS} anggota.`,
        );
      }
      throw new BadRequestException(
        `Circle Premium "${squad.name}" sudah mencapai kapasitas maksimal sistem (${currentMembers}/${PREMIUM_SQUAD_MAX_MEMBERS} anggota) demi menjaga stabilitas performa grup.`,
      );
    }

    await this.prisma.squadMember.create({
      data: {
        squadId: squad.id,
        userId,
        role: Role.MEMBER,
      },
    });

    invalidateSquadCache(squad.id);

    return {
      message: 'Berhasil bergabung ke Circle',
      squad: {
        id: squad.id,
        name: squad.name,
        inviteCode: squad.inviteCode,
        isPremium: squad.isPremium,
        role: Role.MEMBER,
        totalMembers: currentMembers + 1,
        maxMembers,
      },
    };
  }

  /**
   * Meng-upgrade Circle dari Free (maks 5 anggota) ke Premium (maks 25 anggota)
   * menggunakan 100 Koin. Menjalankan query validasi secara paralel (`Promise.all`).
   */
  async upgradeSquad(squadId: string, userId: string) {
    const [squad, membership, user] = await Promise.all([
      this.prisma.squad.findUnique({
        where: { id: squadId },
        include: {
          _count: { select: { members: true } },
        },
      }),
      this.prisma.squadMember.findUnique({
        where: {
          squadId_userId: {
            squadId,
            userId,
          },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, coinBalance: true },
      }),
    ]);

    if (!squad) {
      throw new NotFoundException('Circle tidak ditemukan');
    }

    if (!membership) {
      throw new ForbiddenException(
        'Akses ditolak. Anda bukan anggota Circle ini',
      );
    }

    if (squad.isPremium) {
      throw new BadRequestException(
        `Circle "${squad.name}" sudah berstatus Premium (kapasitas maksimal ${PREMIUM_SQUAD_MAX_MEMBERS} anggota).`,
      );
    }

    if (!user || user.coinBalance < PREMIUM_SQUAD_UPGRADE_COINS) {
      throw new BadRequestException(
        `Saldo koin tidak mencukupi. Diperlukan ${PREMIUM_SQUAD_UPGRADE_COINS} koin untuk meng-upgrade Circle ke Premium (saldo Anda: ${user?.coinBalance ?? 0} koin).`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { coinBalance: { decrement: PREMIUM_SQUAD_UPGRADE_COINS } },
        select: { coinBalance: true },
      });

      if (updatedUser.coinBalance < 0) {
        throw new BadRequestException('Saldo koin tidak mencukupi');
      }

      const updatedSquad = await tx.squad.update({
        where: { id: squadId },
        data: { isPremium: true },
      });

      await tx.coinTransaction.create({
        data: {
          userId,
          amount: -PREMIUM_SQUAD_UPGRADE_COINS,
          type: CoinTxType.BOMB_MISSION_FEE,
          reference: `SQUAD-UPGRADE-${squadId.substring(0, 8)}`,
        },
      });

      return {
        squad: updatedSquad,
        remainingCoinBalance: updatedUser.coinBalance,
      };
    });

    invalidateUserCache(userId);
    invalidateSquadCache(squadId);

    return {
      message: `Circle "${result.squad.name}" berhasil di-upgrade ke Premium (kapasitas hingga ${PREMIUM_SQUAD_MAX_MEMBERS} anggota)!`,
      cost: PREMIUM_SQUAD_UPGRADE_COINS,
      remainingCoinBalance: result.remainingCoinBalance,
      squad: {
        id: result.squad.id,
        name: result.squad.name,
        inviteCode: result.squad.inviteCode,
        isPremium: true,
        totalMembers: squad._count?.members ?? 1,
        maxMembers: PREMIUM_SQUAD_MAX_MEMBERS,
      },
    };
  }

  /**
   * Mengambil daftar Circle yang diikuti pengguna aktif beserta status peran.
   */
  async getMySquads(userId: string) {
    const memberships = await this.prisma.squadMember.findMany({
      where: { userId },
      include: {
        squad: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                members: true,
                quests: {
                  where: { status: 'PENDING' },
                },
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    const squads = memberships.map((membership) => ({
      id: membership.squad.id,
      name: membership.squad.name,
      inviteCode: membership.squad.inviteCode,
      isPremium: membership.squad.isPremium,
      role: membership.role,
      joinedAt: membership.joinedAt,
      totalMembers: membership.squad._count.members,
      maxMembers: this.getMaxMembers(membership.squad.isPremium),
      activeQuestsCount: membership.squad._count.quests,
      captain: membership.squad.createdBy
        ? {
            id: membership.squad.createdBy.id,
            name: membership.squad.createdBy.name,
          }
        : null,
    }));

    return {
      total: squads.length,
      squads,
    };
  }

  /**
   * Mengambil urutan peringkat anggota Circle berdasarkan rankPoints.
   * - Dilengkapi Micro-TTL Cache (5 detik per squadId) untuk meredam lonjakan query
   *   saat hingga 25 anggota membuka Dashboard bersamaan.
   * - Mengeksekusi query secara paralel (`Promise.all`) dan agregasi `activity.groupBy`.
   */
  async getLeaderboard(squadId: string, userId: string) {
    const cacheKey = `leaderboard:${squadId}`;
    const cached = appMemoryCache.get<CachedLeaderboardPayload>(cacheKey);
    if (cached && cached.memberIds.has(userId)) {
      return {
        squad: cached.squad,
        totalMembers: cached.totalMembers,
        maxMembers: cached.maxMembers,
        leaderboard: cached.entries.map((entry) => ({
          ...entry,
          isCurrentUser: entry.userId === userId,
        })),
      };
    }

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);

    const [squad, membership, members] = await Promise.all([
      this.prisma.squad.findUnique({
        where: { id: squadId },
        select: {
          id: true,
          name: true,
          inviteCode: true,
          isPremium: true,
        },
      }),
      this.prisma.squadMember.findUnique({
        where: {
          squadId_userId: {
            squadId,
            userId,
          },
        },
      }),
      this.prisma.squadMember.findMany({
        where: { squadId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              rankPoints: true,
              shieldTickets: true,
              questsReceived: {
                where: {
                  status: { in: [QuestStatus.PENDING, QuestStatus.ACCEPTED] },
                  deadline: { gt: now },
                },
                select: { id: true },
              },
              coinTransactions: {
                where: {
                  createdAt: { gte: dayAgo },
                },
                orderBy: { createdAt: 'desc' },
                select: { reference: true },
              },
            },
          },
        },
        orderBy: {
          user: {
            rankPoints: 'desc',
          },
        },
      }),
    ]);

    if (!squad) {
      throw new NotFoundException('Circle tidak ditemukan');
    }

    if (!membership) {
      throw new ForbiddenException(
        'Akses ditolak. Anda bukan anggota Circle ini',
      );
    }

    const memberIds = members.map((m) => m.user.id);
    const distanceSums =
      memberIds.length > 0 && this.prisma.activity?.groupBy
        ? ((await this.prisma.activity.groupBy({
            by: ['userId'],
            // Draft yang masih direkam (RECORDING) tidak boleh ikut dihitung di leaderboard.
            where: { userId: { in: memberIds }, status: ActivityStatus.COMPLETED },
            _sum: { distanceMeters: true },
          })) ?? [])
        : [];

    const distanceMap = new Map<string, number>(
      distanceSums.map((row) => [row.userId, row._sum?.distanceMeters ?? 0]),
    );

    const entries = members.map((member, index) => {
      const totalMeters = distanceMap.get(member.user.id) ?? 0;
      const recentTxs = member.user.coinTransactions ?? [];
      const latestRestTx = recentTxs.find(
        (tx) =>
          tx.reference?.startsWith('REST-ACTIVE:') ||
          tx.reference?.startsWith('REST-END:'),
      );
      let restUntil: string | null = null;
      if (latestRestTx?.reference?.startsWith('REST-ACTIVE:')) {
        const exp = new Date(
          latestRestTx.reference.slice('REST-ACTIVE:'.length),
        );
        if (!isNaN(exp.getTime()) && exp > now) {
          restUntil = exp.toISOString();
        }
      }
      const activeMissionsCount = (member.user.questsReceived ?? []).length;
      const availabilityStatus: 'AVAILABLE' | 'IN_MISSION' | 'RESTING' =
        restUntil
          ? 'RESTING'
          : activeMissionsCount > 0
            ? 'IN_MISSION'
            : 'AVAILABLE';

      return {
        rank: index + 1,
        userId: member.user.id,
        name: member.user.name,
        rankPoints: member.user.rankPoints,
        shieldTickets: member.user.shieldTickets,
        totalDistanceKm: Math.round((totalMeters / 1000) * 10) / 10,
        role: member.role,
        joinedAt: member.joinedAt,
        availabilityStatus,
        restUntil,
      };
    });

    const maxMembers = this.getMaxMembers(squad.isPremium);
    const cachePayload: CachedLeaderboardPayload = {
      squad: {
        ...squad,
        maxMembers,
      },
      totalMembers: entries.length,
      maxMembers,
      memberIds: new Set(memberIds),
      entries,
    };

    appMemoryCache.set(cacheKey, cachePayload, LEADERBOARD_CACHE_TTL_MS);

    return {
      squad: cachePayload.squad,
      totalMembers: cachePayload.totalMembers,
      maxMembers: cachePayload.maxMembers,
      leaderboard: entries.map((entry) => ({
        ...entry,
        isCurrentUser: entry.userId === userId,
      })),
    };
  }

  /**
   * Detail informasi Circle untuk anggota.
   */
  async getSquadDetail(squadId: string, userId: string) {
    const squad = await this.prisma.squad.findUnique({
      where: { id: squadId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                rankPoints: true,
                shieldTickets: true,
              },
            },
          },
          orderBy: {
            joinedAt: 'asc',
          },
        },
      },
    });

    if (!squad) {
      throw new NotFoundException('Circle tidak ditemukan');
    }

    const isMember = squad.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException(
        'Akses ditolak. Anda bukan anggota Circle ini',
      );
    }

    return {
      id: squad.id,
      name: squad.name,
      inviteCode: squad.inviteCode,
      isPremium: squad.isPremium,
      maxMembers: this.getMaxMembers(squad.isPremium),
      createdAt: squad.createdAt,
      captain: squad.createdBy,
      members: squad.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        role: m.role,
        rankPoints: m.user.rankPoints,
        shieldTickets: m.user.shieldTickets,
        joinedAt: m.joinedAt,
      })),
    };
  }

  /**
   * Keluar dari Circle.
   * Jika Captain keluar dan masih ada anggota lain, kepemimpinan dipindahkan ke anggota tertua.
   * Jika tidak ada anggota lain, Circle akan dihapus.
   */
  async leaveSquad(squadId: string, userId: string) {
    const member = await this.prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId,
          userId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException(
        'Anda tidak terdaftar sebagai anggota Circle ini',
      );
    }

    if (member.role === Role.CAPTAIN) {
      const otherMembers = await this.prisma.squadMember.findMany({
        where: {
          squadId,
          userId: { not: userId },
        },
        orderBy: {
          joinedAt: 'asc',
        },
      });

      if (otherMembers.length > 0) {
        const nextCaptain = otherMembers[0];
        await this.prisma.$transaction(async (tx) => {
          await tx.squadMember.update({
            where: { id: nextCaptain.id },
            data: { role: Role.CAPTAIN },
          });

          await tx.squad.update({
            where: { id: squadId },
            data: { createdById: nextCaptain.userId },
          });

          await tx.squadMember.delete({
            where: { id: member.id },
          });
        });

        invalidateSquadCache(squadId);

        return {
          message:
            'Berhasil keluar dari Circle. Kepemimpinan dialihkan ke anggota tertua.',
        };
      } else {
        await this.prisma.squad.delete({
          where: { id: squadId },
        });

        invalidateSquadCache(squadId);

        return {
          message:
            'Berhasil keluar dari Circle. Circle telah dihapus karena tidak ada anggota lain tersisa.',
        };
      }
    }

    await this.prisma.squadMember.delete({
      where: { id: member.id },
    });

    invalidateSquadCache(squadId);

    return {
      message: 'Berhasil keluar dari Circle',
    };
  }

  /**
   * Mengeluarkan anggota dari Circle (khusus peran CAPTAIN).
   */
  async kickMember(
    squadId: string,
    captainUserId: string,
    targetUserId: string,
  ) {
    if (captainUserId === targetUserId) {
      throw new BadRequestException(
        'Captain tidak dapat mengeluarkan diri sendiri. Gunakan fitur keluar dari Circle.',
      );
    }

    const [requester, targetMember] = await Promise.all([
      this.prisma.squadMember.findUnique({
        where: {
          squadId_userId: {
            squadId,
            userId: captainUserId,
          },
        },
      }),
      this.prisma.squadMember.findUnique({
        where: {
          squadId_userId: {
            squadId,
            userId: targetUserId,
          },
        },
        include: {
          user: {
            select: { name: true },
          },
        },
      }),
    ]);

    if (!requester || requester.role !== Role.CAPTAIN) {
      throw new ForbiddenException(
        'Hanya Captain yang berhak mengeluarkan anggota dari Circle',
      );
    }

    if (!targetMember) {
      throw new NotFoundException(
        'Anggota yang dituju tidak ditemukan di Circle ini',
      );
    }

    await this.prisma.squadMember.delete({
      where: { id: targetMember.id },
    });

    invalidateSquadCache(squadId);

    return {
      message: `Anggota ${targetMember.user.name} berhasil dikeluarkan dari Circle`,
    };
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSquadDto, JoinSquadDto } from './dto';
import { Role } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class SquadsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const squad = await this.prisma.$transaction(async (tx) => {
      const newSquad = await tx.squad.create({
        data: {
          name: createSquadDto.name.trim(),
          inviteCode,
          isPremium: createSquadDto.isPremium ?? false,
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

      return newSquad;
    });

    return {
      message: 'Circle berhasil dibuat',
      squad: {
        id: squad.id,
        name: squad.name,
        inviteCode: squad.inviteCode,
        isPremium: squad.isPremium,
        createdAt: squad.createdAt,
        role: Role.CAPTAIN,
      },
    };
  }

  /**
   * Bergabung ke Circle menggunakan kode unik 8 karakter.
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

    await this.prisma.squadMember.create({
      data: {
        squadId: squad.id,
        userId,
        role: Role.MEMBER,
      },
    });

    return {
      message: 'Berhasil bergabung ke Circle',
      squad: {
        id: squad.id,
        name: squad.name,
        inviteCode: squad.inviteCode,
        isPremium: squad.isPremium,
        role: Role.MEMBER,
        totalMembers: squad._count.members + 1,
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
                email: true,
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
   */
  async getLeaderboard(squadId: string, userId: string) {
    const squad = await this.prisma.squad.findUnique({
      where: { id: squadId },
      select: {
        id: true,
        name: true,
        inviteCode: true,
      },
    });

    if (!squad) {
      throw new NotFoundException('Circle tidak ditemukan');
    }

    const membership = await this.prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'Akses ditolak. Anda bukan anggota Circle ini',
      );
    }

    const members = await this.prisma.squadMember.findMany({
      where: { squadId },
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
        user: {
          rankPoints: 'desc',
        },
      },
    });

    const leaderboard = members.map((member, index) => ({
      rank: index + 1,
      userId: member.user.id,
      name: member.user.name,
      rankPoints: member.user.rankPoints,
      shieldTickets: member.user.shieldTickets,
      role: member.role,
      joinedAt: member.joinedAt,
      isCurrentUser: member.user.id === userId,
    }));

    return {
      squad,
      totalMembers: leaderboard.length,
      leaderboard,
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
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
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
      createdAt: squad.createdAt,
      captain: squad.createdBy,
      members: squad.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
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

        return {
          message:
            'Berhasil keluar dari Circle. Kepemimpinan dialihkan ke anggota tertua.',
        };
      } else {
        await this.prisma.squad.delete({
          where: { id: squadId },
        });

        return {
          message:
            'Berhasil keluar dari Circle. Circle telah dihapus karena tidak ada anggota lain tersisa.',
        };
      }
    }

    await this.prisma.squadMember.delete({
      where: { id: member.id },
    });

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
    const requester = await this.prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId,
          userId: captainUserId,
        },
      },
    });

    if (!requester || requester.role !== Role.CAPTAIN) {
      throw new ForbiddenException(
        'Hanya Captain yang berhak mengeluarkan anggota dari Circle',
      );
    }

    if (captainUserId === targetUserId) {
      throw new BadRequestException(
        'Captain tidak dapat mengeluarkan diri sendiri. Gunakan fitur keluar dari Circle.',
      );
    }

    const targetMember = await this.prisma.squadMember.findUnique({
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
    });

    if (!targetMember) {
      throw new NotFoundException(
        'Anggota yang dituju tidak ditemukan di Circle ini',
      );
    }

    await this.prisma.squadMember.delete({
      where: { id: targetMember.id },
    });

    return {
      message: `Anggota ${targetMember.user.name} berhasil dikeluarkan dari Circle`,
    };
  }
}

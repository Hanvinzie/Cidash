import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupRunStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

/** Status yang masih "terbuka": menunggu peserta atau sedang berjalan. */
const OPEN: GroupRunStatus[] = [GroupRunStatus.WAITING, GroupRunStatus.ACTIVE];
/** Lobi yang tidak pernah dimulai dianggap ditinggalkan setelah ini. */
const WAITING_TTL_MS = 2 * 60 * 60 * 1000;
/** Sesi berjalan yang tidak pernah ditutup dianggap selesai setelah ini. */
const ACTIVE_TTL_MS = 6 * 60 * 60 * 1000;

const roomInclude = {
  host: { select: { id: true, name: true } },
  participants: {
    orderBy: { joinedAt: 'asc' as const },
    include: { user: { select: { id: true, name: true } } },
  },
} satisfies Prisma.GroupRunInclude;

type RoomRecord = Prisma.GroupRunGetPayload<{ include: typeof roomInclude }>;

export interface GroupRunRoomDto {
  id: string;
  circleId: string;
  hostId: string;
  hostName: string;
  status: GroupRunStatus;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  participants: { userId: string; username: string; joinedAt: string }[];
}

export function toRoomDto(run: RoomRecord): GroupRunRoomDto {
  return {
    id: run.id,
    circleId: run.squadId,
    hostId: run.hostId,
    hostName: run.host.name,
    status: run.status,
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    endedAt: run.endedAt ? run.endedAt.toISOString() : null,
    participants: run.participants.map((p) => ({
      userId: p.userId,
      username: p.user.name,
      joinedAt: p.joinedAt.toISOString(),
    })),
  };
}

/**
 * Sesi Group Run. Database hanya menyimpan STATUS dan KEANGGOTAAN; posisi dan progres peserta lewat
 * Supabase Realtime Broadcast di klien. Setiap aksi memeriksa keanggotaan circle, dan perubahan status memakai
 * update bersyarat (`updateMany` dengan status asal) supaya dua permintaan bersamaan tidak saling menimpa.
 */
@Injectable()
export class GroupRunsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMember(squadId: string, userId: string) {
    const member = await this.prisma.squadMember.findUnique({
      where: { squadId_userId: { squadId, userId } },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Anda bukan anggota circle ini.');
  }

  private async loadRoom(id: string): Promise<RoomRecord> {
    const run = await this.prisma.groupRun.findUnique({ where: { id }, include: roomInclude });
    if (!run) throw new NotFoundException('Sesi Group Run tidak ditemukan.');
    return run;
  }

  /** Tutup sesi yang ditinggalkan (lobi lama / sesi berjalan tanpa penutupan) agar tidak menghalangi sesi baru. */
  private async expireStale(squadId: string) {
    const now = Date.now();
    await this.prisma.groupRun.updateMany({
      where: {
        squadId,
        OR: [
          { status: GroupRunStatus.WAITING, createdAt: { lt: new Date(now - WAITING_TTL_MS) } },
          { status: GroupRunStatus.ACTIVE, startedAt: { lt: new Date(now - ACTIVE_TTL_MS) } },
        ],
      },
      data: { status: GroupRunStatus.FINISHED, endedAt: new Date(now) },
    });
  }

  /** Pengguna hanya boleh berada di satu sesi terbuka pada satu waktu. */
  private async findOtherOpenRoom(userId: string, exceptRunId?: string) {
    return this.prisma.groupRunParticipant.findFirst({
      where: {
        userId,
        groupRun: { status: { in: OPEN } },
        ...(exceptRunId ? { NOT: { groupRunId: exceptRunId } } : {}),
      },
      select: { groupRunId: true },
    });
  }

  async list(userId: string, circleId: string): Promise<{ rooms: GroupRunRoomDto[] }> {
    await this.assertMember(circleId, userId);
    await this.expireStale(circleId);
    const rooms = await this.prisma.groupRun.findMany({
      where: { squadId: circleId, status: { in: OPEN } },
      orderBy: { createdAt: 'asc' },
      include: roomInclude,
    });
    return { rooms: rooms.map(toRoomDto) };
  }

  async get(userId: string, id: string): Promise<{ room: GroupRunRoomDto }> {
    const run = await this.loadRoom(id);
    await this.assertMember(run.squadId, userId);
    return { room: toRoomDto(run) };
  }

  async create(userId: string, circleId: string): Promise<{ room: GroupRunRoomDto }> {
    await this.assertMember(circleId, userId);
    await this.expireStale(circleId);

    const existing = await this.prisma.groupRun.findFirst({
      where: { squadId: circleId, status: { in: OPEN } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Sudah ada sesi Group Run yang terbuka di circle ini. Bergabunglah ke sesi tersebut.');
    }
    if (await this.findOtherOpenRoom(userId)) {
      throw new ConflictException('Anda masih berada di sesi Group Run lain. Keluar dulu sebelum membuat yang baru.');
    }

    const created = await this.prisma.groupRun.create({
      data: { squadId: circleId, hostId: userId, participants: { create: { userId } } },
      select: { id: true },
    });

    // Dua permintaan bersamaan bisa lolos pemeriksaan di atas. Sesi tertua menang; yang lain dibatalkan.
    const open = await this.prisma.groupRun.findMany({
      where: { squadId: circleId, status: { in: OPEN } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    if (open.length > 1 && open[0].id !== created.id) {
      await this.prisma.groupRun.deleteMany({ where: { id: created.id } });
      throw new ConflictException('Sudah ada sesi Group Run yang terbuka di circle ini. Bergabunglah ke sesi tersebut.');
    }

    return { room: toRoomDto(await this.loadRoom(created.id)) };
  }

  async join(userId: string, id: string): Promise<{ room: GroupRunRoomDto }> {
    const run = await this.loadRoom(id);
    await this.assertMember(run.squadId, userId);
    if (run.status === GroupRunStatus.FINISHED) throw new BadRequestException('Sesi Group Run ini sudah selesai.');

    if (!run.participants.some((p) => p.userId === userId)) {
      if (await this.findOtherOpenRoom(userId, id)) {
        throw new ConflictException('Anda masih berada di sesi Group Run lain. Keluar dulu sebelum bergabung.');
      }
      await this.prisma.groupRunParticipant.upsert({
        where: { groupRunId_userId: { groupRunId: id, userId } },
        create: { groupRunId: id, userId },
        update: {},
      });
    }
    return { room: toRoomDto(await this.loadRoom(id)) };
  }

  async start(userId: string, id: string): Promise<{ room: GroupRunRoomDto }> {
    const run = await this.loadRoom(id);
    await this.assertMember(run.squadId, userId);
    if (run.hostId !== userId) throw new ForbiddenException('Hanya host yang dapat memulai sesi.');
    if (run.status !== GroupRunStatus.WAITING) {
      throw new BadRequestException(
        run.status === GroupRunStatus.ACTIVE ? 'Sesi sudah berjalan.' : 'Sesi Group Run ini sudah selesai.',
      );
    }
    const res = await this.prisma.groupRun.updateMany({
      where: { id, status: GroupRunStatus.WAITING },
      data: { status: GroupRunStatus.ACTIVE, startedAt: new Date() },
    });
    if (res.count === 0) throw new BadRequestException('Sesi sudah berjalan.');
    return { room: toRoomDto(await this.loadRoom(id)) };
  }

  async leave(userId: string, id: string): Promise<{ room: GroupRunRoomDto | null }> {
    const run = await this.loadRoom(id);
    await this.assertMember(run.squadId, userId);
    if (!run.participants.some((p) => p.userId === userId)) return { room: toRoomDto(run) };

    await this.prisma.groupRunParticipant.deleteMany({ where: { groupRunId: id, userId } });
    const remaining = run.participants.filter((p) => p.userId !== userId);

    if (run.status !== GroupRunStatus.FINISHED) {
      if (remaining.length === 0) {
        await this.prisma.groupRun.updateMany({
          where: { id, status: { in: OPEN } },
          data: { status: GroupRunStatus.FINISHED, endedAt: new Date() },
        });
      } else if (run.hostId === userId) {
        // Host keluar: peserta tertua menjadi host baru agar sesi tidak macet tanpa pemimpin.
        await this.prisma.groupRun.updateMany({ where: { id }, data: { hostId: remaining[0].userId } });
      }
    }
    const room = await this.prisma.groupRun.findUnique({ where: { id }, include: roomInclude });
    return { room: room ? toRoomDto(room) : null };
  }

  async finish(userId: string, id: string): Promise<{ room: GroupRunRoomDto }> {
    const run = await this.loadRoom(id);
    await this.assertMember(run.squadId, userId);
    if (run.hostId !== userId) throw new ForbiddenException('Hanya host yang dapat mengakhiri sesi.');
    await this.prisma.groupRun.updateMany({
      where: { id, status: { in: OPEN } },
      data: { status: GroupRunStatus.FINISHED, endedAt: new Date() },
    });
    return { room: toRoomDto(await this.loadRoom(id)) };
  }
}

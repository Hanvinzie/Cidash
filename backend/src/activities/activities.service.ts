import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { invalidateUserCache } from '../common/cache/memory-cache';
import { AntiCheatService } from './services/anti-cheat.service';
import { CreateActivityDto } from './dto';
import { ActivityStatus, PointTxType, QuestStatus } from '@prisma/client';
import { SyncActivityBatchDto } from './dto';
import {
  decodePolyline,
  decodeSegments,
  encodePolyline,
  encodeSegments,
  isValidLatLng,
  type LatLng,
} from '../common/utils/polyline';

/** Batas titik per rute — selaras dengan MAX_ROUTE_POINTS di AntiCheatService. */
const MAX_ROUTE_POINTS = 10_000;
/** Batas titik per batch sync (client mengirim ±15 titik; sisanya toleransi untuk antrean offline). */
const MAX_BATCH_POINTS = 1_000;
/** Draft yang tidak pernah di-update selama ini dianggap ditinggalkan (app ditutup / baterai habis). */
const STALE_DRAFT_MS = 24 * 60 * 60 * 1000;

interface ResolvedRoute {
  /** Polyline kanonik (presisi 5, segmen dipisah ';') yang disimpan di database. */
  encoded: string;
  /** Segmen GeoJSON [lng, lat] untuk AntiCheatService (celah antar-segmen = jeda, bukan lonjakan). */
  segments: [number, number][][];
  start: LatLng | null;
  end: LatLng | null;
}

function toRoute(segments: LatLng[][]): ResolvedRoute {
  const total = segments.reduce((n, s) => n + s.length, 0);
  if (total > MAX_ROUTE_POINTS) {
    throw new BadRequestException(
      `Aktivitas ditolak: Jumlah titik koordinat melebihi batas maksimum (${MAX_ROUTE_POINTS} titik).`,
    );
  }
  if (!segments.every((s) => s.every(isValidLatLng))) {
    throw new BadRequestException(
      'Aktivitas ditolak: Format koordinat GPS tidak valid.',
    );
  }
  const nonEmpty = segments.filter((s) => s.length > 0);
  return {
    encoded: encodeSegments(nonEmpty),
    segments: nonEmpty.map((s) => s.map(([lat, lng]) => [lng, lat] as [number, number])),
    start: nonEmpty[0]?.[0] ?? null,
    end: nonEmpty[nonEmpty.length - 1]?.[nonEmpty[nonEmpty.length - 1].length - 1] ?? null,
  };
}

function safeDecode(encoded: string): LatLng[] {
  try {
    return decodePolyline(encoded);
  } catch {
    throw new BadRequestException('encodedPolyline tidak valid atau terpotong');
  }
}

function safeDecodeSegments(encoded: string): LatLng[][] {
  try {
    return decodeSegments(encoded);
  } catch {
    throw new BadRequestException('encodedPolyline tidak valid atau terpotong');
  }
}

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly antiCheatService: AntiCheatService,
  ) {}

  /**
   * Menyimpan log perekaman aktivitas olahraga GPS baru.
   * Melakukan verifikasi anti-cheat otomatis, proteksi anti-replay / double-submit,
   * mencocokkan misi aktif, serta mengalokasikan rankPoints ke pengguna.
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

    const nowMs = Date.now();
    if (endedAt.getTime() > nowMs + 5 * 60_000) {
      throw new BadRequestException(
        'Waktu selesai olahraga tidak boleh berada di masa depan',
      );
    }

    const wallClockSeconds = (endedAt.getTime() - startedAt.getTime()) / 1000;
    if (wallClockSeconds < createActivityDto.durationSeconds * 0.8) {
      throw new BadRequestException(
        'Durasi aktivitas tidak konsisten dengan rentang waktu mulai dan selesai',
      );
    }

    // Hitung ulang pace secara server-side agar tidak bisa dimanipulasi dari client
    const serverAveragePace = Number(
      (
        createActivityDto.durationSeconds /
        60 /
        (createActivityDto.distanceMeters / 1000)
      ).toFixed(2),
    );

    // Rute final = SATU polyline. Client lama yang masih mengirim routeGeoJson di-encode di sini.
    const route = this.resolveRoute(createActivityDto);

    // Sesi draft (hasil batch sync) harus milik user ini dan belum diselesaikan.
    const sessionId = createActivityDto.id;
    const draft = sessionId
      ? await this.prisma.activity.findUnique({
          where: { id: sessionId },
          select: { userId: true, status: true },
        })
      : null;
    if (draft && draft.userId !== userId) {
      throw new ForbiddenException('Sesi aktivitas ini bukan milik Anda.');
    }
    if (draft && draft.status === ActivityStatus.COMPLETED) {
      throw new ConflictException(
        'Aktivitas olahraga ini sudah pernah tercatat sebelumnya (terdeteksi pengiriman ganda).',
      );
    }

    // 1. Validasi Anti-Cheat Otomatis (Kecepatan, Anomali Pace, Lonjakan Koordinat Haversine)
    const validation = this.antiCheatService.validateActivity(
      createActivityDto.type,
      createActivityDto.distanceMeters,
      createActivityDto.durationSeconds,
      serverAveragePace,
      { type: 'MultiLineString', coordinates: route.segments },
      true,
    );

    // 2. Jalankan pengecekan Anti-Replay & pencarian kandidat misi aktif secara paralel (hemat 1 roundtrip DB)
    const duplicateWindowStart = new Date(endedAt.getTime() - 15_000);
    const duplicateWindowEnd = new Date(endedAt.getTime() + 15_000);

    const [recentDuplicate, activeQuests] = await Promise.all([
      this.prisma.activity?.findFirst
        ? this.prisma.activity.findFirst({
            where: {
              userId,
              status: ActivityStatus.COMPLETED,
              ...(sessionId ? { NOT: { id: sessionId } } : {}),
              endedAt: {
                gte: duplicateWindowStart,
                lte: duplicateWindowEnd,
              },
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      this.prisma.quest.findMany({
        where: {
          targetUserId: userId,
          status: { in: [QuestStatus.PENDING, QuestStatus.ACCEPTED] },
          deadline: { gt: startedAt },
          activityType: createActivityDto.type,
        },
        orderBy: {
          stakesPoints: 'desc', // Prioritaskan misi dengan taruhan terbesar
        },
      }),
    ]);

    if (recentDuplicate) {
      throw new ConflictException(
        'Aktivitas olahraga ini sudah pernah tercatat sebelumnya (terdeteksi pengiriman ganda).',
      );
    }

    // 3. Pencocokan Otomatis: Cari misi yang syarat jarak dan pace terpenuhi
    const matchedQuest = activeQuests.find((quest) => {
      const distanceMet =
        createActivityDto.distanceMeters >= quest.targetDistance;
      const paceMet =
        !quest.targetMaxPace || serverAveragePace <= quest.targetMaxPace;
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

    const summary = {
      type: createActivityDto.type,
      status: ActivityStatus.COMPLETED,
      distanceMeters: createActivityDto.distanceMeters,
      durationSeconds: createActivityDto.durationSeconds,
      averagePace: serverAveragePace,
      encodedPolyline: route.encoded,
      startLat: route.start?.[0] ?? null,
      startLng: route.start?.[1] ?? null,
      endLat: route.end?.[0] ?? null,
      endLng: route.end?.[1] ?? null,
      elevationGain: createActivityDto.elevationGain ?? 0,
      locationLabel: createActivityDto.locationLabel?.trim() || null,
      startedAt,
      endedAt,
    };

    // 5. Simpan Aktivitas, Perbarui Misi, dan Catat Alokasi Poin secara Atomik
    const result = await this.prisma.$transaction(async (tx) => {
      // Selesaikan draft yang sudah ada (1 baris per aktivitas) atau buat baris baru.
      const activity = draft
        ? await tx.activity.update({
            where: { id: sessionId },
            data: summary,
          })
        : await tx.activity.create({
            data: { ...(sessionId ? { id: sessionId } : {}), userId, ...summary },
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

    invalidateUserCache(userId);

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

  /** Ubah body create menjadi satu rute kanonik (polyline baru atau GeoJSON lama). */
  private resolveRoute(dto: CreateActivityDto): ResolvedRoute {
    if (dto.encodedPolyline) {
      return toRoute(safeDecodeSegments(dto.encodedPolyline));
    }
    if (dto.routeGeoJson) {
      const segments = this.antiCheatService.extractSegments(dto.routeGeoJson);
      return toRoute(segments.map((seg) => seg.map(([lng, lat]) => [lat, lng] as LatLng)));
    }
    throw new BadRequestException(
      'Aktivitas ditolak: encodedPolyline (rute GPS) wajib diisi.',
    );
  }

  /**
   * Batch sync periodik saat merekam (±15 titik / 30 detik, serta saat Pause).
   * Membuat baris draft pada batch pertama, lalu meng-update baris yang SAMA pada batch berikutnya.
   * Idempoten: titik yang sudah diterima dilewati, sehingga retry setelah sinyal buruk aman.
   * Mengembalikan `pointCount` agar client tahu dari indeks mana harus mengirim ulang.
   */
  async syncBatch(userId: string, activityId: string, dto: SyncActivityBatchDto) {
    const startedAt = new Date(dto.startedAt);
    if (isNaN(startedAt.getTime())) {
      throw new BadRequestException('Format waktu mulai tidak valid');
    }
    if (startedAt.getTime() > Date.now() + 5 * 60_000) {
      throw new BadRequestException('Waktu mulai tidak boleh berada di masa depan');
    }

    const incoming = safeDecode(dto.polyline);
    if (incoming.length > MAX_BATCH_POINTS) {
      throw new BadRequestException(
        `Batch melebihi ${MAX_BATCH_POINTS} titik. Kirim lebih sering.`,
      );
    }
    if (!incoming.every(isValidLatLng)) {
      throw new BadRequestException('Format koordinat GPS tidak valid.');
    }

    const existing = await this.prisma.activity.findUnique({
      where: { id: activityId },
      select: { userId: true, status: true, encodedPolyline: true },
    });
    if (existing && existing.userId !== userId) {
      throw new ForbiddenException('Sesi aktivitas ini bukan milik Anda.');
    }
    if (existing && existing.status === ActivityStatus.COMPLETED) {
      throw new ConflictException('Aktivitas ini sudah selesai dan tidak bisa diubah.');
    }

    const stored = existing?.encodedPolyline ? safeDecode(existing.encodedPolyline) : [];
    // fromIndex <= stored: batch bersambung/tumpang tindih → tambahkan hanya titik baru.
    // fromIndex > stored: ada batch yang hilang → jangan menyambung, minta client kirim ulang dari pointCount.
    const accepted = dto.fromIndex <= stored.length;
    const merged = accepted
      ? stored.concat(incoming.slice(stored.length - dto.fromIndex))
      : stored;
    if (merged.length > MAX_ROUTE_POINTS) {
      throw new BadRequestException(
        `Jumlah titik koordinat melebihi batas maksimum (${MAX_ROUTE_POINTS} titik).`,
      );
    }

    const distanceMeters = Math.round(dto.distanceMeters);
    const durationSeconds = Math.max(1, dto.durationSeconds); // CHECK constraint: durationSeconds > 0
    const data = {
      type: dto.type,
      distanceMeters,
      durationSeconds,
      averagePace:
        distanceMeters >= 50
          ? Number((durationSeconds / 60 / (distanceMeters / 1000)).toFixed(2))
          : 0,
      encodedPolyline: encodePolyline(merged),
      startLat: merged[0]?.[0] ?? null,
      startLng: merged[0]?.[1] ?? null,
      endLat: merged[merged.length - 1]?.[0] ?? null,
      endLng: merged[merged.length - 1]?.[1] ?? null,
      elevationGain: dto.elevationGain ?? 0,
      startedAt,
      endedAt: new Date(), // dipakai sebagai penanda "terakhir di-sync" untuk membersihkan draft usang
    };

    if (existing) {
      await this.prisma.activity.update({ where: { id: activityId }, data });
    } else {
      // Bersihkan draft ditinggalkan milik user ini sebelum membuat sesi baru.
      await this.prisma.activity.deleteMany({
        where: {
          userId,
          status: ActivityStatus.RECORDING,
          endedAt: { lt: new Date(Date.now() - STALE_DRAFT_MS) },
        },
      });
      await this.prisma.activity.create({
        data: { id: activityId, userId, status: ActivityStatus.RECORDING, ...data },
      });
    }

    return { pointCount: merged.length, accepted };
  }

  /** Membuang draft (user menekan Discard). Hanya draft milik sendiri yang belum selesai. */
  async discardDraft(userId: string, activityId: string) {
    const { count } = await this.prisma.activity.deleteMany({
      where: { id: activityId, userId, status: ActivityStatus.RECORDING },
    });
    return { deleted: count > 0 };
  }

  /**
   * Baris lama hanya punya routeGeoJson. Encode saat dibaca agar API hanya mengekspos polyline,
   * tanpa migrasi data besar-besaran.
   */
  private withPolyline<T extends { encodedPolyline: string | null; routeGeoJson: unknown }>(
    row: T,
  ): string | null {
    if (row.encodedPolyline) return row.encodedPolyline;
    if (!row.routeGeoJson) return null;
    try {
      const lngLat = this.antiCheatService.extractCoordinates(row.routeGeoJson);
      const points = lngLat
        .map(([lng, lat]) => [lat, lng] as LatLng)
        .filter(isValidLatLng);
      return points.length > 0 ? encodePolyline(points) : null;
    } catch {
      return null;
    }
  }

  /**
   * Mengambil riwayat seluruh rekaman olahraga pengguna lampau dengan agregasi metrik.
   * Mendukung Cursor-based pagination (O(1) index seek), Offset pagination yang dibatasi,
   * serta proyeksi opsional tanpa rute (`includeRoute=false`) untuk mempercepat list.
   */
  async getHistory(
    userId: string,
    page = 1,
    limit = 10,
    cursor?: string,
    includeRoute = true,
  ) {
    const completed = { userId, status: ActivityStatus.COMPLETED };
    const pageNumber = Math.max(1, Math.min(100, Number(page) || 1));
    const pageSize = Math.max(1, Math.min(50, Number(limit) || 10));
    const useCursor = Boolean(cursor && /^[0-9a-fA-F-]{36}$/.test(cursor));
    const skip = useCursor ? 1 : (pageNumber - 1) * pageSize;

    const [activities, totalCount, aggregate] = await Promise.all([
      this.prisma.activity.findMany({
        where: completed,
        select: {
          id: true,
          type: true,
          distanceMeters: true,
          durationSeconds: true,
          averagePace: true,
          encodedPolyline: includeRoute,
          // Hanya dibaca untuk baris lama yang belum punya polyline.
          routeGeoJson: includeRoute,
          startLat: true,
          startLng: true,
          endLat: true,
          endLng: true,
          elevationGain: true,
          locationLabel: true,
          startedAt: true,
          endedAt: true,
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
        ...(useCursor ? { cursor: { id: cursor } } : {}),
        skip,
        take: pageSize,
      }),
      this.prisma.activity.count({ where: completed }),
      this.prisma.activity.aggregate({
        where: completed,
        _sum: {
          distanceMeters: true,
          durationSeconds: true,
        },
      }),
    ]);

    const totalDistanceMeters = aggregate._sum.distanceMeters ?? 0;
    const totalDurationSeconds = aggregate._sum.durationSeconds ?? 0;
    const nextCursor =
      activities.length === pageSize
        ? activities[activities.length - 1]?.id ?? null
        : null;

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
        nextCursor,
      },
      activities: activities.map((item) => ({
        id: item.id,
        type: item.type,
        distanceMeters: item.distanceMeters,
        distanceKilometers:
          Math.round((item.distanceMeters / 1000) * 100) / 100,
        durationSeconds: item.durationSeconds,
        averagePace: item.averagePace,
        ...(includeRoute ? { encodedPolyline: this.withPolyline(item) } : {}),
        startLat: item.startLat,
        startLng: item.startLng,
        endLat: item.endLat,
        endLng: item.endLng,
        elevationGain: item.elevationGain,
        locationLabel: item.locationLabel,
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        completedQuest: item.questMatches[0] ?? null,
      })),
    };
  }

  /**
   * Mengambil detail spesifik satu aktivitas lengkap dengan rute (encoded polyline).
   */
  async getActivityDetail(activityId: string, userId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        user: { select: { id: true, name: true } },
        questMatches: {
          select: {
            id: true,
            rewardTitle: true,
            stakesPoints: true,
            status: true,
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('Data aktivitas tidak ditemukan');
    }

    if (activity.userId !== userId) {
      throw new ForbiddenException(
        'Akses ditolak. Anda hanya dapat melihat detail aktivitas Anda sendiri.',
      );
    }

    const { routeGeoJson: _legacy, ...rest } = activity;
    return { ...rest, encodedPolyline: this.withPolyline(activity) };
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CoinTxType, QuestStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import {
  appMemoryCache,
  invalidateUserCache,
  USER_AUTH_CACHE_TTL_MS,
} from '../common/cache/memory-cache';
import { LoginDto, RegisterDto } from './dto';

export const MAX_SHIELD_TICKETS = 2;
export const SHIELD_WEEKLY_COSTS = [25, 50] as const;
export const REST_WEEKLY_COSTS = [0, 15] as const;
export const REST_DURATION_MS = 24 * 3600 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;

export type AvailabilityStatus = 'AVAILABLE' | 'IN_MISSION' | 'RESTING';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Menghitung status ketersediaan Bomb Mission & kuota mingguan Shield/Rest Mode.
   * Menggunakan proyeksi kolom minimal (`select: { reference: true }`) agar PostgreSQL
   * dapat mengeksekusi Index-Only Scan.
   */
  async getUserAvailabilityAndEconomy(userId: string, shieldTickets = 0) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

    const [recentCoinTxs, activeIncomingCount] = await Promise.all([
      this.prisma.coinTransaction?.findMany
        ? this.prisma.coinTransaction.findMany({
            where: {
              userId,
              createdAt: { gte: weekAgo },
            },
            orderBy: { createdAt: 'desc' },
            select: { reference: true },
          })
        : Promise.resolve([]),
      this.prisma.quest?.count
        ? this.prisma.quest.count({
            where: {
              targetUserId: userId,
              status: { in: [QuestStatus.PENDING, QuestStatus.ACCEPTED] },
              deadline: { gt: now },
            },
          })
        : Promise.resolve(0),
    ]);

    const weeklyShieldsBought = recentCoinTxs.filter((tx) =>
      tx.reference?.startsWith('SHIELD-BUY-'),
    ).length;

    const weeklyRestUsed = recentCoinTxs.filter((tx) =>
      tx.reference?.startsWith('REST-ACTIVE:'),
    ).length;

    const latestRestEvent = recentCoinTxs.find(
      (tx) =>
        tx.reference?.startsWith('REST-ACTIVE:') ||
        tx.reference?.startsWith('REST-END:'),
    );

    let restUntil: string | null = null;
    if (latestRestEvent?.reference?.startsWith('REST-ACTIVE:')) {
      const iso = latestRestEvent.reference.slice('REST-ACTIVE:'.length);
      const exp = new Date(iso);
      if (!isNaN(exp.getTime()) && exp > now) {
        restUntil = exp.toISOString();
      }
    }

    const availabilityStatus: AvailabilityStatus = restUntil
      ? 'RESTING'
      : activeIncomingCount > 0
        ? 'IN_MISSION'
        : 'AVAILABLE';

    const nextShieldCost =
      shieldTickets >= MAX_SHIELD_TICKETS ||
      weeklyShieldsBought >= SHIELD_WEEKLY_COSTS.length
        ? null
        : SHIELD_WEEKLY_COSTS[weeklyShieldsBought];

    const nextRestCost =
      weeklyRestUsed >= REST_WEEKLY_COSTS.length
        ? null
        : REST_WEEKLY_COSTS[weeklyRestUsed];

    return {
      availabilityStatus,
      restUntil,
      weeklyShieldsBought,
      maxWeeklyShields: SHIELD_WEEKLY_COSTS.length,
      maxShieldTickets: MAX_SHIELD_TICKETS,
      nextShieldCost,
      weeklyRestUsed,
      maxWeeklyRest: REST_WEEKLY_COSTS.length,
      nextRestCost,
    };
  }

  async register(registerDto: RegisterDto) {
    const email = registerDto.email.trim().toLowerCase();
    const name = registerDto.name.trim();
    const { password } = registerDto;

    // Cek apakah email sudah terdaftar
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Email sudah terdaftar');
    }

    // Hash password dengan bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Simpan ke database dengan default 100 points, 60 starter coins, dan 1 shield ticket
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        coinBalance: 60,
        rankPoints: 100,
        shieldTickets: 1,
      },
      select: {
        id: true,
        email: true,
        name: true,
        coinBalance: true,
        rankPoints: true,
        shieldTickets: true,
        createdAt: true,
      },
    });

    appMemoryCache.set(`user:${user.id}`, user, USER_AUTH_CACHE_TTL_MS);

    // Akun baru pasti memiliki 0 riwayat transaksi & 0 misi aktif (hemat 2 roundtrip DB)
    const initialEconomy = {
      availabilityStatus: 'AVAILABLE' as AvailabilityStatus,
      restUntil: null,
      weeklyShieldsBought: 0,
      maxWeeklyShields: SHIELD_WEEKLY_COSTS.length,
      maxShieldTickets: MAX_SHIELD_TICKETS,
      nextShieldCost: SHIELD_WEEKLY_COSTS[0],
      weeklyRestUsed: 0,
      maxWeeklyRest: REST_WEEKLY_COSTS.length,
      nextRestCost: REST_WEEKLY_COSTS[0],
    };

    // Buat JWT access token
    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      message: 'Registrasi berhasil',
      accessToken,
      user: {
        ...user,
        ...initialEconomy,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const { password } = loginDto;

    // Cari user berdasarkan email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Email atau password salah');
    }

    // Validasi password hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const userRecord = {
      id: user.id,
      email: user.email,
      name: user.name,
      coinBalance: user.coinBalance,
      rankPoints: user.rankPoints,
      shieldTickets: user.shieldTickets,
      createdAt: user.createdAt,
    };
    appMemoryCache.set(`user:${user.id}`, userRecord, USER_AUTH_CACHE_TTL_MS);

    const [economy, accessToken] = await Promise.all([
      this.getUserAvailabilityAndEconomy(user.id, user.shieldTickets),
      this.jwtService.signAsync({ sub: user.id, email: user.email }),
    ]);

    return {
      message: 'Login berhasil',
      accessToken,
      user: {
        ...userRecord,
        ...economy,
      },
    };
  }

  async getProfile(userId: string) {
    const cachedUser = appMemoryCache.get<{
      id: string;
      email: string;
      name: string;
      coinBalance: number;
      rankPoints: number;
      shieldTickets: number;
      createdAt: Date;
    }>(`user:${userId}`);

    const user =
      cachedUser ??
      (await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          coinBalance: true,
          rankPoints: true,
          shieldTickets: true,
          createdAt: true,
        },
      }));

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    if (!cachedUser) {
      appMemoryCache.set(`user:${user.id}`, user, USER_AUTH_CACHE_TTL_MS);
    }

    const economy = await this.getUserAvailabilityAndEconomy(
      user.id,
      user.shieldTickets,
    );

    return {
      ...user,
      ...economy,
    };
  }

  async topUpCoins(userId: string, coins: number) {
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          coinBalance: { increment: coins },
        },
        select: {
          id: true,
          email: true,
          name: true,
          coinBalance: true,
          rankPoints: true,
          shieldTickets: true,
          createdAt: true,
        },
      });

      await tx.coinTransaction.create({
        data: {
          userId,
          amount: coins,
          type: CoinTxType.TOP_UP,
          reference: `TOPUP-${Date.now().toString(36).toUpperCase()}`,
        },
      });

      return u;
    });

    invalidateUserCache(userId);
    appMemoryCache.set(
      `user:${updatedUser.id}`,
      updatedUser,
      USER_AUTH_CACHE_TTL_MS,
    );

    const economy = await this.getUserAvailabilityAndEconomy(
      updatedUser.id,
      updatedUser.shieldTickets,
    );

    return {
      message: `Berhasil top up ${coins} koin`,
      coinBalance: updatedUser.coinBalance,
      user: {
        ...updatedUser,
        ...economy,
      },
    };
  }

  /**
   * Membeli 1 Shield Ticket menggunakan Koin dengan batas maksimal kepemilikan 2 tiket
   * dan kuota maksimal 2 pembelian per minggu (harga bertingkat: 25 koin -> 50 koin)
   * agar tidak menjadi Pay-to-Win.
   */
  async buyShieldTicket(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, coinBalance: true, shieldTickets: true },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    if (user.shieldTickets >= MAX_SHIELD_TICKETS) {
      throw new BadRequestException(
        `Inventory Shield penuh (maksimal ${MAX_SHIELD_TICKETS} Shield Ticket agar kompetisi tetap adil).`,
      );
    }

    const economy = await this.getUserAvailabilityAndEconomy(
      user.id,
      user.shieldTickets,
    );

    if (economy.weeklyShieldsBought >= SHIELD_WEEKLY_COSTS.length) {
      throw new BadRequestException(
        `Batas pembelian mingguan tercapai (maksimal ${SHIELD_WEEKLY_COSTS.length} Shield Ticket per minggu untuk mencegah Pay-to-Win).`,
      );
    }

    const cost = SHIELD_WEEKLY_COSTS[economy.weeklyShieldsBought];
    if (user.coinBalance < cost) {
      throw new BadRequestException(
        `Saldo koin tidak mencukupi. Harga Shield Ticket saat ini ${cost} koin (saldo Anda: ${user.coinBalance} koin).`,
      );
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          coinBalance: { decrement: cost },
          shieldTickets: { increment: 1 },
        },
        select: {
          id: true,
          email: true,
          name: true,
          coinBalance: true,
          rankPoints: true,
          shieldTickets: true,
          createdAt: true,
        },
      });

      if (u.coinBalance < 0 || u.shieldTickets > MAX_SHIELD_TICKETS) {
        throw new BadRequestException('Gagal memproses pembelian Shield Ticket');
      }

      await tx.coinTransaction.create({
        data: {
          userId,
          amount: -cost,
          type: CoinTxType.PURCHASE_SHIELD,
          reference: `SHIELD-BUY-${Date.now().toString(36).toUpperCase()}`,
        },
      });

      return u;
    });

    invalidateUserCache(userId);
    appMemoryCache.set(
      `user:${updatedUser.id}`,
      updatedUser,
      USER_AUTH_CACHE_TTL_MS,
    );

    const nextEconomy = await this.getUserAvailabilityAndEconomy(
      updatedUser.id,
      updatedUser.shieldTickets,
    );

    return {
      message: `Berhasil membeli 1 Shield Ticket seharga ${cost} koin`,
      cost,
      coinBalance: updatedUser.coinBalance,
      shieldTickets: updatedUser.shieldTickets,
      user: {
        ...updatedUser,
        ...nextEconomy,
      },
    };
  }

  /**
   * Mengatur status ketersediaan Bomb Mission pengguna (AVAILABLE atau RESTING 24 jam).
   * - 1x Rest Mode pertama tiap minggu: Gratis (0 koin)
   * - Rest Mode ke-2 di minggu yang sama: 15 koin
   * - Maksimal 2x Rest Mode per minggu agar pemain #1 tidak bisa bersembunyi selamanya.
   */
  async updateAvailabilityStatus(
    userId: string,
    targetStatus: 'AVAILABLE' | 'RESTING',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, coinBalance: true, shieldTickets: true },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const economy = await this.getUserAvailabilityAndEconomy(
      user.id,
      user.shieldTickets,
    );

    if (targetStatus === 'AVAILABLE') {
      if (economy.availabilityStatus === 'RESTING') {
        await this.prisma.coinTransaction.create({
          data: {
            userId,
            amount: 0,
            type: CoinTxType.PURCHASE_SHIELD,
            reference: `REST-END:${new Date().toISOString()}`,
          },
        });
        invalidateUserCache(userId);
      }
      const nextEconomy = await this.getUserAvailabilityAndEconomy(
        user.id,
        user.shieldTickets,
      );
      return {
        message: 'Status diubah menjadi Ready (Siap menerima tantangan)',
        cost: 0,
        coinBalance: user.coinBalance,
        ...nextEconomy,
      };
    }

    if (economy.availabilityStatus === 'RESTING') {
      return {
        message: 'Anda sudah berada dalam Rest Mode',
        cost: 0,
        coinBalance: user.coinBalance,
        ...economy,
      };
    }

    if (economy.availabilityStatus === 'IN_MISSION') {
      throw new BadRequestException(
        'Tidak dapat mengaktifkan Rest Mode saat masih memiliki Bomb Mission aktif yang belum diselesaikan.',
      );
    }

    if (economy.weeklyRestUsed >= REST_WEEKLY_COSTS.length) {
      throw new BadRequestException(
        `Kuota Rest Mode mingguan habis (maksimal ${REST_WEEKLY_COSTS.length}x per minggu agar leaderboard tetap kompetitif).`,
      );
    }

    const cost = REST_WEEKLY_COSTS[economy.weeklyRestUsed];
    if (user.coinBalance < cost) {
      throw new BadRequestException(
        `Saldo koin tidak mencukupi untuk Rest Mode tambahan (${cost} koin).`,
      );
    }

    const expiresAt = new Date(Date.now() + REST_DURATION_MS).toISOString();

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const u =
        cost > 0
          ? await tx.user.update({
              where: { id: userId },
              data: { coinBalance: { decrement: cost } },
              select: { coinBalance: true },
            })
          : { coinBalance: user.coinBalance };

      await tx.coinTransaction.create({
        data: {
          userId,
          amount: -cost,
          type: CoinTxType.PURCHASE_SHIELD,
          reference: `REST-ACTIVE:${expiresAt}`,
        },
      });

      return u;
    });

    invalidateUserCache(userId);

    const nextEconomy = await this.getUserAvailabilityAndEconomy(
      user.id,
      user.shieldTickets,
    );

    return {
      message:
        cost > 0
          ? `Rest Mode diaktifkan selama 24 jam (${cost} koin)`
          : 'Rest Mode gratis mingguan diaktifkan selama 24 jam',
      cost,
      coinBalance: updatedUser.coinBalance,
      ...nextEconomy,
    };
  }
}

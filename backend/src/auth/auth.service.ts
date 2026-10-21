import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CoinTxType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const email = registerDto.email.trim().toLowerCase();
    const name = registerDto.name.trim();
    const { password } = registerDto;

    // Cek apakah email sudah terdaftar
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
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

    // Buat JWT access token
    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      message: 'Registrasi berhasil',
      accessToken,
      user,
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

    // Buat JWT access token
    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      message: 'Login berhasil',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        coinBalance: user.coinBalance,
        rankPoints: user.rankPoints,
        shieldTickets: user.shieldTickets,
        createdAt: user.createdAt,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
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
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return user;
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

    return {
      message: `Berhasil top up ${coins} koin`,
      coinBalance: updatedUser.coinBalance,
      user: updatedUser,
    };
  }
}

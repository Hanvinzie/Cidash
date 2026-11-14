import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import {
  appMemoryCache,
  USER_AUTH_CACHE_TTL_MS,
} from '../../common/cache/memory-cache';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthenticatedUserRecord {
  id: string;
  email: string;
  name: string;
  coinBalance: number;
  rankPoints: number;
  shieldTickets: number;
  createdAt: Date;
}

const jwtLogger = new Logger('JwtConfig');

export function resolveJwtSecret(configService: ConfigService): string {
  const secret =
    configService.get<string>('JWT_SECRET')?.trim() ||
    process.env.JWT_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Konfigurasi keamanan kritis: Variabel environment JWT_SECRET wajib diatur di production.',
      );
    }
    jwtLogger.warn(
      'JWT_SECRET belum diatur di .env — menggunakan kunci fallback khusus mode development.',
    );
    return 'dev_only_cidash_jwt_secret_key_change_in_prod';
  }
  return secret;
}

function extractTokenFromHeaderOrCookie(req: Request): string | null {
  const bearer = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (bearer) return bearer;
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('cidash_token='));
  return match ? decodeURIComponent(match.slice('cidash_token='.length)) : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: extractTokenFromHeaderOrCookie,
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(configService),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUserRecord> {
    const cacheKey = `user:${payload.sub}`;
    const cachedUser = appMemoryCache.get<AuthenticatedUserRecord>(cacheKey);
    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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
      throw new UnauthorizedException('User tidak ditemukan atau sesi telah berakhir');
    }

    appMemoryCache.set(cacheKey, user, USER_AUTH_CACHE_TTL_MS);
    return user;
  }
}

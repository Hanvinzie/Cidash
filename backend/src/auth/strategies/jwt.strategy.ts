import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(configService),
    });
  }

  async validate(payload: JwtPayload) {
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

    return user;
  }
}

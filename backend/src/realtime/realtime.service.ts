import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';

/** Umur token Supabase (detik). Pendek: klien meminta ulang dan token tidak berguna bila bocor. */
export const REALTIME_TOKEN_TTL_SECONDS = 60 * 60;

export interface RealtimeTokenResult {
  /** null = fitur tidak dikonfigurasi di server; klien memakai sinyal Broadcast + REST saja. */
  token: string | null;
  expiresAt: number | null;
}

/**
 * Menerbitkan JWT untuk Supabase Realtime. Auth aplikasi memakai JWT NestJS (bukan Supabase Auth), sehingga klien
 * Supabase hanya membawa anon key publik. Token ini membawa daftar circle milik pengguna; policy RLS pada tabel
 * "GroupRun" memakainya agar `postgres_changes` hanya mengirim baris dari circle pengguna sendiri.
 * Diperlukan env SUPABASE_JWT_SECRET (JWT secret proyek Supabase, Settings → API).
 */
@Injectable()
export class RealtimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issueToken(userId: string): Promise<RealtimeTokenResult> {
    const secret = this.config.get<string>('SUPABASE_JWT_SECRET')?.trim();
    if (!secret) return { token: null, expiresAt: null };

    const memberships = await this.prisma.squadMember.findMany({
      where: { userId },
      select: { squadId: true },
    });
    const token = this.jwt.sign(
      {
        aud: 'authenticated',
        role: 'authenticated',
        sub: userId,
        circles: memberships.map((m) => m.squadId),
      },
      { secret, algorithm: 'HS256', expiresIn: REALTIME_TOKEN_TTL_SECONDS },
    );
    return { token, expiresAt: Date.now() + REALTIME_TOKEN_TTL_SECONDS * 1000 };
  }
}

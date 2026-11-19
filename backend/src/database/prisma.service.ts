import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function redactDbCredentials(msg: string): string {
  return msg.replace(
    /(postgres(?:ql)?:\/\/[^:\s]+:)([^@\s]+)(@)/gi,
    '$1***REDACTED***$3',
  );
}

/**
 * Memastikan parameter connection pooling terpasang pada DATABASE_URL
 * sehingga lonjakan konkurensi tinggi tidak menghabiskan koneksi PostgreSQL.
 *
 * Khusus di Vercel Serverless + Supabase Pooler:
 * - Port 5432 (Session Mode) dibatasi hanya 15 klien total -> mudah kena EMAXCONNSESSION.
 * - Port 6543 (Transaction Mode / PgBouncer) mendukung ratusan klien serverless serentak.
 */
function ensurePoolingParams(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const isSupabasePooler = parsed.hostname.endsWith('.pooler.supabase.com');

    if (process.env.VERCEL && isSupabasePooler && (!parsed.port || parsed.port === '5432')) {
      parsed.port = '6543';
    }

    if (parsed.port === '6543') {
      parsed.searchParams.set('pgbouncer', 'true');
    }

    if (process.env.VERCEL) {
      // Wajib 1 koneksi per lambda instance agar tidak menghabiskan pool
      parsed.searchParams.set('connection_limit', '1');
    } else if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', '15');
    }

    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '20');
    }
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '10');
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public isConnected = false;

  constructor() {
    const fallbackUrl =
      'postgresql://postgres:postgres@localhost:5432/cidash?schema=public';
    const configuredUrl = ensurePoolingParams(
      process.env.DATABASE_URL?.trim() || fallbackUrl,
    );
    process.env.DATABASE_URL = configuredUrl;

    super({
      datasources: {
        db: { url: configuredUrl },
      },
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
      transactionOptions: {
        maxWait: 5_000,
        timeout: 10_000,
      },
    });
  }

  async onModuleInit() {
    // Di Vercel serverless, biarkan Prisma lazy-connect saat query pertama agar cold start
    // lebih cepat dan tidak menahan koneksi idle di pooler.
    if (process.env.VERCEL) {
      this.isConnected = true;
      return;
    }
    try {
      await this.$connect();
      this.isConnected = true;
      this.logger.log('Database terhubung dengan sukses.');
    } catch (error) {
      this.isConnected = false;
      const rawMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Database belum terhubung (${redactDbCredentials(rawMsg)}). Server tetap berjalan dalam mode tanpa koneksi DB.`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.$disconnect().catch(() => undefined);
    }
  }
}

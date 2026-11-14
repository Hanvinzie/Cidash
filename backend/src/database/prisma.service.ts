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
 */
function ensurePoolingParams(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', '15');
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '15');
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

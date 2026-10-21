import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public isConnected = false;

  constructor() {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL =
        'postgresql://postgres:postgres@localhost:5432/cidash?schema=public';
    }
    super();
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.isConnected = true;
      this.logger.log('Database terhubung dengan sukses.');
    } catch (error) {
      this.isConnected = false;
      this.logger.warn(
        `Database belum terhubung (${error instanceof Error ? error.message : 'Unknown error'}). Server tetap berjalan dalam mode tanpa koneksi DB.`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.$disconnect().catch(() => undefined);
    }
  }
}

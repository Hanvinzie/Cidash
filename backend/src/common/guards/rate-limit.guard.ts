import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const RATE_LIMIT_KEY = 'rate_limit_options';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export const RateLimit = (limit: number, windowMs = 60_000) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowMs });

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    if (!req) return true;

    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? { limit: 120, windowMs: 60_000 };

    const ip =
      (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';
    const routeKey = `${req.method}:${req.route?.path || req.url || 'global'}`;
    const key = `${ip}:${routeKey}`;
    const now = Date.now();

    if (this.buckets.size > 5000) {
      for (const [k, v] of this.buckets.entries()) {
        if (v.resetAt <= now) this.buckets.delete(k);
      }
    }

    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    existing.count += 1;
    if (existing.count > options.limit) {
      throw new HttpException(
        'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

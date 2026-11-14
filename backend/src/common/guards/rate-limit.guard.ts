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

const MAX_BUCKETS = 10_000;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly reflector: Reflector) {}

  private evictExpiredOrOldest(now: number) {
    for (const [k, v] of this.buckets.entries()) {
      if (v.resetAt <= now) {
        this.buckets.delete(k);
      }
    }
    // Jika masih melebihi kapasitas akibat banjir IP acak (DDoS), buang 20% entri tertua agar memori tetap aman
    if (this.buckets.size >= MAX_BUCKETS) {
      const toRemove = Math.ceil(MAX_BUCKETS * 0.2);
      let removed = 0;
      for (const k of this.buckets.keys()) {
        this.buckets.delete(k);
        removed++;
        if (removed >= toRemove) break;
      }
    }
  }

  canActivate(context: ExecutionContext): boolean {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest();
    const res = httpCtx.getResponse();
    if (!req) return true;

    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? { limit: 100, windowMs: 60_000 };

    const ip =
      (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';

    // Gunakan kombinasi userId (jika sudah terautentikasi) + IP agar adil di jaringan kantor/kampus (NAT)
    // sekaligus mencegah spam per akun maupun per IP.
    const actorKey = req.user?.id ? `usr:${req.user.id}:${ip}` : `ip:${ip}`;
    const routeKey = `${req.method}:${req.route?.path || req.baseUrl || req.url?.split('?')[0] || 'global'}`;
    const key = `${actorKey}:${routeKey}`;
    const now = Date.now();

    if (this.buckets.size >= MAX_BUCKETS) {
      this.evictExpiredOrOldest(now);
    }

    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 1, resetAt: now + options.windowMs };
      this.buckets.set(key, bucket);
    } else {
      bucket.count += 1;
    }

    const remaining = Math.max(0, options.limit - bucket.count);
    const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    if (res?.setHeader) {
      res.setHeader('X-RateLimit-Limit', String(options.limit));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(resetSeconds));
    }

    if (bucket.count > options.limit) {
      if (res?.setHeader) {
        res.setHeader('Retry-After', String(resetSeconds));
      }
      throw new HttpException(
        `Terlalu banyak permintaan. Silakan tunggu ${resetSeconds} detik sebelum mencoba kembali.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

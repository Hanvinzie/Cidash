import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Sembunyikan header X-Powered-By agar teknologi server tidak terekspos
  const expressApp = app.getHttpAdapter().getInstance();
  if (expressApp?.disable) {
    expressApp.disable('x-powered-by');
  }

  // Security headers & proteksi cache data sensitif
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'",
    );
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(self), camera=(), microphone=()',
    );
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  // Prevent oversized payload DoS (e.g. huge routeGeoJson)
  app.use(json({ limit: '250kb' }));
  app.use(urlencoded({ extended: true, limit: '250kb' }));

  const configuredOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production' && configuredOrigins.length > 0
        ? configuredOrigins
        : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'ngrok-skip-browser-warning',
      'X-Cron-Secret',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ],
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );

  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(
    `\n======================================================\n` +
      `  CIDASH SIAP DIGUNAKAN (Ctrl + Klik link di bawah):\n` +
      `  -> Buka Aplikasi (Frontend): http://localhost:5173\n` +
      `  -> Server API    (Backend) : http://localhost:${port}\n` +
      `======================================================\n`,
  );
}
bootstrap();

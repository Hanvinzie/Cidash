import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import express, { json, urlencoded } from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

export async function configureApp(app: INestApplication): Promise<void> {
  app.setGlobalPrefix('api');

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
}

let cachedServerPromise: Promise<Express> | null = null;

export function createServerlessApp(): Promise<Express> {
  if (!cachedServerPromise) {
    cachedServerPromise = (async () => {
      const expressApp = express();
      const app = await NestFactory.create(
        AppModule,
        new ExpressAdapter(expressApp),
      );
      await configureApp(app);
      await app.init();
      return expressApp;
    })().catch((err) => {
      cachedServerPromise = null;
      throw err;
    });
  }
  return cachedServerPromise;
}

export async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const server = await createServerlessApp();
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      res.off('finish', onDone);
      res.off('close', onDone);
      res.off('error', onError);
    };
    const onDone = () => {
      cleanup();
      resolve();
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    res.once('finish', onDone);
    res.once('close', onDone);
    res.once('error', onError);

    try {
      server(req as Request, res as Response);
      if (res.writableEnded) {
        onDone();
      }
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

export default handler;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await configureApp(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(
    `\n======================================================\n` +
      `  CIDASH SIAP DIGUNAKAN (Ctrl + Klik link di bawah):\n` +
      `  -> Buka Aplikasi (Frontend): http://localhost:5173\n` +
      `  -> Server API    (Backend) : http://localhost:${port}/api\n` +
      `======================================================\n`,
  );
}

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  void bootstrap();
}

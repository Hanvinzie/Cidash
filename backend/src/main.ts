import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers (equivalent to helmet defaults without external dependency)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(self), camera=(), microphone=()',
    );
    next();
  });

  // Prevent oversized payload DoS (e.g. huge routeGeoJson)
  app.use(json({ limit: '500kb' }));
  app.use(urlencoded({ extended: true, limit: '500kb' }));

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'ngrok-skip-browser-warning',
      'X-Cron-Secret',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

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

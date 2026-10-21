import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

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

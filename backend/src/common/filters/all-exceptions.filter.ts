import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Global exception filter yang memastikan tidak ada kebocoran stack trace,
 * struktur tabel Prisma, atau kredensial database ke respons klien.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  private sanitizeLogMessage(msg: string): string {
    return msg.replace(
      /(postgres(?:ql)?:\/\/[^:\s]+:)([^@\s]+)(@)/gi,
      '$1***REDACTED***$3',
    );
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resBody = exception.getResponse();
      const payload =
        typeof resBody === 'object' && resBody !== null
          ? resBody
          : { statusCode: status, message: String(resBody) };

      response.status(status).json({
        ...payload,
        timestamp: new Date().toISOString(),
        path: request?.url,
      });
      return;
    }

    // Error internal / Prisma / Database: jangan pernah bocorkan detail SQL/koneksi ke klien
    const rawMsg =
      exception instanceof Error ? exception.message : 'Unknown internal error';
    this.logger.error(
      `[${request?.method} ${request?.url}] ${this.sanitizeLogMessage(rawMsg)}`,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        'Terjadi kesalahan internal pada server. Silakan coba beberapa saat lagi.',
      timestamp: new Date().toISOString(),
      path: request?.url,
    });
  }
}

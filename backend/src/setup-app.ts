import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Baseline security headers for the API (S8). Kept dependency-free on
 * purpose: three static headers do not justify pulling in helmet.
 *
 * HSTS and X-Robots-Tag belong to the public frontend origin, not the API.
 */
function securityHeaders(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

export function setupApp(app: INestApplication): void {
  app.use(securityHeaders);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
}

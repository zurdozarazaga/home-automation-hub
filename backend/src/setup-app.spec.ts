import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { setupApp } from './setup-app';

type Middleware = (
  request: Request,
  response: Response,
  next: NextFunction,
) => void;

describe('setupApp', () => {
  const buildApp = (): {
    app: INestApplication;
    middlewares: Middleware[];
    useGlobalPipes: jest.Mock;
    useGlobalFilters: jest.Mock;
  } => {
    const middlewares: Middleware[] = [];
    const useGlobalPipes = jest.fn();
    const useGlobalFilters = jest.fn();

    return {
      app: {
        use: (middleware: Middleware) => {
          middlewares.push(middleware);
        },
        useGlobalPipes,
        useGlobalFilters,
      } as unknown as INestApplication,
      middlewares,
      useGlobalPipes,
      useGlobalFilters,
    };
  };

  it('registers the security headers middleware on every response', () => {
    const { app, middlewares } = buildApp();

    setupApp(app);

    expect(middlewares).toHaveLength(1);

    const setHeader = jest.fn();
    const next = jest.fn();

    middlewares[0](
      {} as Request,
      { setHeader } as unknown as Response,
      next as NextFunction,
    );

    expect(setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('keeps the global validation pipe and exception filter wiring', () => {
    const { app, useGlobalPipes, useGlobalFilters } = buildApp();

    setupApp(app);

    expect(useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(useGlobalFilters).toHaveBeenCalledTimes(1);
  });
});

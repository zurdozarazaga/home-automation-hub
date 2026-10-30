import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from '../decorators/public.decorator';

const SECRET = 'guard-spec-secret';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;

  const buildContext = (
    handler: (...args: unknown[]) => unknown,
    headers: Record<string, string> = {},
  ): { context: ExecutionContext; request: { user?: unknown } } => {
    const request: { headers: Record<string, string>; user?: unknown } = {
      headers,
    };
    const context = {
      getHandler: () => handler,
      getClass: () => Object,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  };

  class Handlers {
    plain(this: void): void {}
    @Public()
    open(this: void): void {}
  }
  const handlers = new Handlers();

  beforeEach(() => {
    jwtService = new JwtService({ secret: SECRET });
    guard = new JwtAuthGuard(new Reflector(), jwtService);
  });

  it('allows @Public() routes without a token', async () => {
    const { context } = buildContext(handlers.open);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects missing Authorization header with 401', async () => {
    const { context } = buildContext(handlers.plain);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects non-Bearer scheme with 401', async () => {
    const { context } = buildContext(handlers.plain, {
      authorization: 'Token abc',
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects invalid token with 401', async () => {
    const { context } = buildContext(handlers.plain, {
      authorization: 'Bearer not-a-token',
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects expired token with 401', async () => {
    const expired = await jwtService.signAsync({
      sub: 'admin-1',
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    const { context } = buildContext(handlers.plain, {
      authorization: `Bearer ${expired}`,
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('sets request.user and allows valid token', async () => {
    const token = await jwtService.signAsync({ sub: 'svc', role: 'service' });
    const { context, request } = buildContext(handlers.plain, {
      authorization: `Bearer ${token}`,
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ sub: 'svc', role: 'service' });
  });
});

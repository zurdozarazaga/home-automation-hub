import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Public } from '../decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  class Handlers {
    undecorated(this: void): void {}
    @Public()
    open(this: void): void {}
    @Roles('admin', 'service')
    execute(this: void): void {}
  }
  const handlers = new Handlers();

  const buildContext = (
    handler: (...args: unknown[]) => unknown,
    user?: JwtPayload,
  ): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => Handlers,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new RolesGuard(new Reflector());
  });

  it('allows @Public() routes without a user', () => {
    expect(guard.canActivate(buildContext(handlers.open))).toBe(true);
  });

  it('denies routes without @Roles() by default (403)', () => {
    expect(() =>
      guard.canActivate(
        buildContext(handlers.undecorated, { sub: 'a', role: 'admin' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows a caller whose role matches @Roles()', () => {
    expect(
      guard.canActivate(
        buildContext(handlers.execute, { sub: 'svc', role: 'service' }),
      ),
    ).toBe(true);
  });

  it('denies viewer on service/admin route with 403', () => {
    expect(() =>
      guard.canActivate(
        buildContext(handlers.execute, { sub: 'v', role: 'viewer' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('denies missing user with 403', () => {
    expect(() => guard.canActivate(buildContext(handlers.execute))).toThrow(
      ForbiddenException,
    );
  });
});

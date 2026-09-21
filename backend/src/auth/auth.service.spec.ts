import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH_TOKEN_TTL, AUTH_TOKEN_TTL_SECONDS } from './auth.constants';
import { AuthService } from './auth.service';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

describe('AuthService', () => {
  const secret = 'login-spec-secret';
  let service: AuthService;
  let previousUsername: string | undefined;
  let previousPassword: string | undefined;

  const verify = (token: string): Promise<JwtPayload> =>
    new JwtService({ secret }).verifyAsync<JwtPayload>(token);

  beforeEach(() => {
    previousUsername = process.env.AUTH_USERNAME;
    previousPassword = process.env.AUTH_PASSWORD;
    process.env.AUTH_USERNAME = 'spec-admin';
    process.env.AUTH_PASSWORD = 'spec-password';

    service = new AuthService(
      new JwtService({ secret, signOptions: { expiresIn: AUTH_TOKEN_TTL } }),
    );
  });

  afterEach(() => {
    if (previousUsername === undefined) {
      delete process.env.AUTH_USERNAME;
    } else {
      process.env.AUTH_USERNAME = previousUsername;
    }

    if (previousPassword === undefined) {
      delete process.env.AUTH_PASSWORD;
    } else {
      process.env.AUTH_PASSWORD = previousPassword;
    }
  });

  it('issues a 24h admin token for valid credentials', async () => {
    const response = await service.login({
      username: 'spec-admin',
      password: 'spec-password',
    });

    expect(response.expiresIn).toBe(AUTH_TOKEN_TTL_SECONDS);

    const payload = await verify(response.accessToken);
    expect(payload).toMatchObject({ sub: 'spec-admin', role: 'admin' });
    expect(payload.exp! - payload.iat!).toBe(AUTH_TOKEN_TTL_SECONDS);
  });

  it('defaults the username to admin when AUTH_USERNAME is not set', async () => {
    delete process.env.AUTH_USERNAME;

    const response = await service.login({
      username: 'admin',
      password: 'spec-password',
    });

    const payload = await verify(response.accessToken);
    expect(payload.sub).toBe('admin');
  });

  it('rejects a wrong password with a generic 401', async () => {
    await expect(
      service.login({ username: 'spec-admin', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a wrong username with the same generic 401', async () => {
    await expect(
      service.login({ username: 'intruder', password: 'spec-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns 503 and mints nothing when AUTH_PASSWORD is not set', async () => {
    delete process.env.AUTH_PASSWORD;

    await expect(
      service.login({ username: 'spec-admin', password: 'spec-password' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('treats an empty AUTH_PASSWORD as not configured', async () => {
    process.env.AUTH_PASSWORD = '';

    await expect(
      service.login({ username: 'spec-admin', password: '' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

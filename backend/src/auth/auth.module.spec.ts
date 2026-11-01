import { Logger } from '@nestjs/common';
import { enforceProductionSecrets } from './auth.module';

describe('enforceProductionSecrets', () => {
  const strongSecret = 'a'.repeat(48);
  const strongPassword = 'correct horse battery staple';
  let previousNodeEnv: string | undefined;
  let previousSecret: string | undefined;
  let previousPassword: string | undefined;

  beforeEach(() => {
    previousNodeEnv = process.env.NODE_ENV;
    previousSecret = process.env.JWT_SECRET;
    previousPassword = process.env.AUTH_PASSWORD;
  });

  afterEach(() => {
    const restore = (
      key: 'NODE_ENV' | 'JWT_SECRET' | 'AUTH_PASSWORD',
      value: string | undefined,
    ): void => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    };

    restore('NODE_ENV', previousNodeEnv);
    restore('JWT_SECRET', previousSecret);
    restore('AUTH_PASSWORD', previousPassword);
    jest.restoreAllMocks();
  });

  it('fails fast when JWT_SECRET is missing in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    process.env.AUTH_PASSWORD = strongPassword;

    expect(() => enforceProductionSecrets()).toThrow(
      'JWT_SECRET is required in production',
    );
  });

  it('warns without logging values when the secret and password are short', () => {
    const weakSecret = 'weak-secret-value';
    const weakPassword = 'weakpass-1';
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = weakSecret;
    process.env.AUTH_PASSWORD = weakPassword;

    expect(() => enforceProductionSecrets()).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(error).not.toHaveBeenCalled();

    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain(weakSecret);
    expect(logged).not.toContain(weakPassword);
  });

  it('logs an error but does not throw when AUTH_PASSWORD is missing', () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = strongSecret;
    delete process.env.AUTH_PASSWORD;

    expect(() => enforceProductionSecrets()).not.toThrow();
    expect(error).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('stays silent outside production', () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    process.env.NODE_ENV = 'test';
    delete process.env.JWT_SECRET;
    delete process.env.AUTH_PASSWORD;

    expect(() => enforceProductionSecrets()).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});

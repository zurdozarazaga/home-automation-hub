import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { setupApp } from './../src/setup-app';

describe('Auth login (e2e)', () => {
  let app: INestApplication<App>;
  let previousUsername: string | undefined;
  let previousPassword: string | undefined;

  const restoreEnv = (
    key: 'AUTH_USERNAME' | 'AUTH_PASSWORD',
    value: string | undefined,
  ): void => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  };

  beforeEach(async () => {
    previousUsername = process.env.AUTH_USERNAME;
    previousPassword = process.env.AUTH_PASSWORD;
    process.env.AUTH_USERNAME = 'e2e-admin';
    process.env.AUTH_PASSWORD = 'e2e-password';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterEach(async () => {
    restoreEnv('AUTH_USERNAME', previousUsername);
    restoreEnv('AUTH_PASSWORD', previousPassword);
    await app.close();
  });

  it('returns a 24h admin token for valid credentials (200)', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'e2e-admin', password: 'e2e-password' })
      .expect(200);

    const body = response.body as { accessToken: string; expiresIn: number };
    expect(typeof body.accessToken).toBe('string');
    expect(body.expiresIn).toBe(86400);

    // The issued token must open an admin-guarded route.
    await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);
  });

  it('rejects a wrong password with a generic 401', () =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'e2e-admin', password: 'wrong-password' })
      .expect(401)
      .expect((response) => {
        const body = response.body as { message: string };
        expect(body.message).toBe('Invalid credentials');
      }));

  it('rejects an unknown username with the same generic 401', () =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'intruder', password: 'e2e-password' })
      .expect(401)
      .expect((response) => {
        const body = response.body as { message: string };
        expect(body.message).toBe('Invalid credentials');
      }));

  it('returns 503 while AUTH_PASSWORD is not configured', async () => {
    delete process.env.AUTH_PASSWORD;

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'e2e-admin', password: 'e2e-password' })
      .expect(503);
  });

  it('validates the request body (400)', () =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '', password: '' })
      .expect(400));
});

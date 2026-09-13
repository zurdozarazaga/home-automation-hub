import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { setupApp } from './../src/setup-app';

describe('Auth RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  const jwtService = new JwtService({
    secret: process.env.JWT_SECRET ?? 'test-secret',
  });
  const tokens: Record<string, string> = {};

  const buildFetchResponse = (): Response =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const createDevice = async (token: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Auth Matrix ${Math.random().toString(36).slice(2)}`,
        description: 'auth matrix device',
        ipAddress: `192.168.9.${Math.floor(Math.random() * 200) + 10}`,
        port: 80,
      });
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  };

  beforeAll(async () => {
    tokens.admin = await jwtService.signAsync({
      sub: 'e2e-admin',
      role: 'admin',
    });
    tokens.viewer = await jwtService.signAsync({
      sub: 'e2e-viewer',
      role: 'viewer',
    });
    tokens.service = await jwtService.signAsync({
      sub: 'n8n-sistema-riego',
      role: 'service',
    });
    tokens.expired = await jwtService.signAsync({
      sub: 'e2e-old',
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(buildFetchResponse());
  });

  it('rejects unauthenticated device call with 401', () =>
    request(app.getHttpServer()).get('/devices').expect(401));

  it('rejects expired token with 401', () =>
    request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${tokens.expired}`)
      .expect(401));

  it('rejects viewer device creation with 403', () =>
    request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${tokens.viewer}`)
      .send({
        name: 'Viewer Device',
        description: 'should be rejected',
        ipAddress: '192.168.9.50',
        port: 80,
      })
      .expect(403));

  it('rejects service device management with 403', () =>
    request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${tokens.service}`)
      .send({
        name: 'Service Device',
        description: 'should be rejected',
        ipAddress: '192.168.9.51',
        port: 80,
      })
      .expect(403));

  it('lets service execute actions and blocks viewer', async () => {
    const deviceId = await createDevice(tokens.admin);

    await request(app.getHttpServer())
      .post(`/devices/${deviceId}/actions`)
      .set('Authorization', `Bearer ${tokens.service}`)
      .send({ action: 'turn_on', target: 'riego' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/devices/${deviceId}/actions`)
      .set('Authorization', `Bearer ${tokens.viewer}`)
      .send({ action: 'turn_on', target: 'riego' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/devices/${deviceId}/actions`)
      .send({ action: 'turn_on', target: 'riego' })
      .expect(401);
  });

  it('restricts n8n dispatch to the service role', async () => {
    const deviceId = await createDevice(tokens.admin);
    const body = { deviceId, action: 'turn_off', target: 'luces' };

    await request(app.getHttpServer())
      .post('/integrations/n8n/actions')
      .set('Authorization', `Bearer ${tokens.service}`)
      .send(body)
      .expect(201);

    await request(app.getHttpServer())
      .post('/integrations/n8n/actions')
      .set('Authorization', `Bearer ${tokens.viewer}`)
      .send(body)
      .expect(403);

    await request(app.getHttpServer())
      .post('/integrations/n8n/actions')
      .send(body)
      .expect(401);
  });

  it('keeps health checks public', () =>
    request(app.getHttpServer()).get('/health').expect(200));

  afterEach(async () => {
    fetchSpy.mockRestore();
    await app.close();
  });
});

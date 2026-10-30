import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { setupApp } from './../src/setup-app';

describe('Telemetry RBAC (e2e)', () => {
  let app: INestApplication<App>;
  const jwtService = new JwtService({
    secret: process.env.JWT_SECRET ?? 'test-secret',
  });
  const tokens: Record<string, string> = {};

  const buildReadingBatch = (): {
    readings: Array<{
      ts: string;
      metric: string;
      value: number;
      unit: string;
      source: string;
    }>;
  } => ({
    readings: [
      {
        ts: new Date().toISOString(),
        metric: 'temperature',
        value: 21.5,
        unit: 'celsius',
        source: 'dht22',
      },
    ],
  });

  const createDevice = async (token: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Telemetry Matrix ${Math.random().toString(36).slice(2)}`,
        description: 'telemetry matrix device',
        ipAddress: `192.168.10.${Math.floor(Math.random() * 200) + 10}`,
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
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lets service ingest and viewer query telemetry', async () => {
    const deviceId = await createDevice(tokens.admin);

    const ingestResponse = await request(app.getHttpServer())
      .post(`/devices/${deviceId}/telemetry/batch`)
      .set('Authorization', `Bearer ${tokens.service}`)
      .send(buildReadingBatch());

    expect(ingestResponse.status).toBe(201);
    expect((ingestResponse.body as { count: number }).count).toBe(1);

    const queryResponse = await request(app.getHttpServer())
      .get(`/devices/${deviceId}/telemetry`)
      .query({ metric: 'temperature' })
      .set('Authorization', `Bearer ${tokens.viewer}`);

    expect(queryResponse.status).toBe(200);
    const readings = queryResponse.body as Array<{ metric: string }>;
    expect(readings.length).toBeGreaterThan(0);
    expect(readings[0]?.metric).toBe('temperature');
  });

  it('blocks viewer telemetry ingest with 403', async () => {
    const deviceId = await createDevice(tokens.admin);

    await request(app.getHttpServer())
      .post(`/devices/${deviceId}/telemetry/batch`)
      .set('Authorization', `Bearer ${tokens.viewer}`)
      .send(buildReadingBatch())
      .expect(403);
  });

  it('blocks telemetry ingest and query without a token (401)', async () => {
    const deviceId = await createDevice(tokens.admin);

    await request(app.getHttpServer())
      .post(`/devices/${deviceId}/telemetry/batch`)
      .send(buildReadingBatch())
      .expect(401);

    await request(app.getHttpServer())
      .get(`/devices/${deviceId}/telemetry`)
      .expect(401);
  });
});

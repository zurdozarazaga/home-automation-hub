import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { setupApp } from './../src/setup-app';

const uniqueSuffix = (): string => Math.random().toString(36).slice(2, 10);

const uniqueIp = (): string =>
  `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

const uniqueMac = (): string => {
  const pair = (): string =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();

  return `C0:4E:30:${pair()}:${pair()}:${pair()}`;
};

describe('Board push link (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  const jwtService = new JwtService({
    secret: process.env.JWT_SECRET ?? 'test-secret',
  });
  const tokens: Record<string, string> = {};
  const createdDeviceIds: string[] = [];

  const createPushDevice = async (): Promise<{ id: string; mac: string }> => {
    const createResponse = await request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({
        name: `Board Push ${uniqueSuffix()}`,
        description: 'push link e2e device',
        ipAddress: uniqueIp(),
        port: 80,
      });

    expect(createResponse.status).toBe(201);
    const id = (createResponse.body as { id: string }).id;
    const mac = uniqueMac();

    await prisma.device.update({
      where: { id },
      data: { macAddress: mac, lastSeenAt: new Date(), status: 'online' },
    });
    createdDeviceIds.push(id);

    return { id, mac };
  };

  beforeAll(async () => {
    process.env.DEVICE_LINK_MODE = 'push';
    process.env.BOARD_SWEEP_INTERVAL_MS = '0';
    prisma = new PrismaClient();

    tokens.admin = await jwtService.signAsync({
      sub: 'e2e-admin',
      role: 'admin',
    });
    tokens.viewer = await jwtService.signAsync({
      sub: 'e2e-viewer',
      role: 'viewer',
    });
    tokens.service = await jwtService.signAsync({
      sub: 'e2e-board',
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

  afterAll(async () => {
    if (createdDeviceIds.length > 0) {
      await prisma.device.deleteMany({
        where: { id: { in: createdDeviceIds } },
      });
    }
    await prisma.$disconnect();
    delete process.env.DEVICE_LINK_MODE;
    delete process.env.BOARD_SWEEP_INTERVAL_MS;
  });

  it('rejects /board/sync without a token and for the viewer role', async () => {
    const { mac } = await createPushDevice();

    await request(app.getHttpServer())
      .post('/board/sync')
      .send({ mac })
      .expect(401);

    await request(app.getHttpServer())
      .post('/board/sync')
      .set('Authorization', `Bearer ${tokens.viewer}`)
      .send({ mac })
      .expect(403);
  });

  it('answers 404 with a registration hint for an unknown MAC', async () => {
    await request(app.getHttpServer())
      .post('/board/sync')
      .set('Authorization', `Bearer ${tokens.service}`)
      .send({ mac: uniqueMac() })
      .expect(404)
      .expect((response) => {
        const body = response.body as { message?: string };
        expect(body.message).toContain('--mac');
      });
  });

  it('queues an action, dispatches it on sync, acks it and logs the outcome', async () => {
    const { id, mac } = await createPushDevice();

    const actionResponse = await request(app.getHttpServer())
      .post(`/devices/${id}/actions`)
      .set('Authorization', `Bearer ${tokens.service}`)
      .send({ action: 'turn_on', target: 'riego' })
      .expect(202);

    const queued = actionResponse.body as {
      commandId: string;
      result: string;
      endpoint: string;
    };
    expect(queued.result).toBe('queued');
    expect(queued.endpoint).toBe('/riego/on');
    expect(queued.commandId).toBeDefined();

    // The ActionLog is written on the ack, not at enqueue time.
    expect(await prisma.actionLog.count({ where: { deviceId: id } })).toBe(0);

    const syncResponse = await request(app.getHttpServer())
      .post('/board/sync')
      .set('Authorization', `Bearer ${tokens.service}`)
      .send({
        mac,
        fw: '0.5.0',
        uptime_s: 1234,
        rssi_dbm: -42,
        reset_reason: 'POWERON',
        relays: { riego: 'off', luces: 'off' },
        sensors: {
          temperature_c: null,
          humidity_pct: null,
          valid: false,
          age_s: null,
        },
        acks: [],
      })
      .expect(200);

    const syncBody = syncResponse.body as {
      deviceId: string;
      commands: Array<{ id: string; action: string; target: string }>;
    };
    expect(syncBody.deviceId).toBe(id);
    expect(syncBody.commands).toContainEqual({
      id: queued.commandId,
      action: 'turn_on',
      target: 'riego',
    });

    const dispatched = await prisma.deviceCommand.findUnique({
      where: { id: queued.commandId },
    });
    expect(dispatched?.status).toBe('dispatched');

    await request(app.getHttpServer())
      .post('/board/sync')
      .set('Authorization', `Bearer ${tokens.service}`)
      .send({
        mac,
        fw: '0.5.0',
        uptime_s: 1240,
        rssi_dbm: -41,
        reset_reason: 'POWERON',
        relays: { riego: 'on', luces: 'off' },
        sensors: {
          temperature_c: 21.5,
          humidity_pct: 55.2,
          valid: true,
          age_s: 2,
        },
        acks: [{ id: queued.commandId, ok: true, httpStatus: 200 }],
      })
      .expect(200);

    const acked = await prisma.deviceCommand.findUnique({
      where: { id: queued.commandId },
    });
    expect(acked).toMatchObject({ status: 'acked', result: 'success' });

    const actionLog = await prisma.actionLog.findFirst({
      where: { deviceId: id },
      orderBy: { createdAt: 'desc' },
    });
    expect(actionLog).toMatchObject({
      action: 'turn_on',
      target: 'riego',
      endpoint: '/riego/on',
      result: 'success',
      httpStatusCode: 200,
    });

    const telemetryResponse = await request(app.getHttpServer())
      .get(`/devices/${id}/telemetry`)
      .query({ metric: 'temperature' })
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(200);

    const readings = telemetryResponse.body as Array<{
      metric: string;
      source: string;
    }>;
    expect(readings).toHaveLength(1);
    expect(readings[0]).toMatchObject({
      metric: 'temperature',
      source: 'dht22',
    });
  });

  it('answers 502 and logs a failed action when the board is stale', async () => {
    const { id } = await createPushDevice();

    await prisma.device.update({
      where: { id },
      data: { lastSeenAt: new Date(Date.now() - 60000) },
    });

    await request(app.getHttpServer())
      .post(`/devices/${id}/actions`)
      .set('Authorization', `Bearer ${tokens.service}`)
      .send({ action: 'turn_off', target: 'luces' })
      .expect(502);

    const actionLog = await prisma.actionLog.findFirst({
      where: { deviceId: id },
      orderBy: { createdAt: 'desc' },
    });
    expect(actionLog).toMatchObject({
      action: 'turn_off',
      target: 'luces',
      endpoint: '/luces/off',
      result: 'failed',
      httpStatusCode: 502,
    });
    expect(actionLog?.errorMessage).toContain('offline');
  });
});

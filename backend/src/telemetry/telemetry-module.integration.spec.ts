import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DatabaseModule } from '../database/database.module';
import { DevicesModule } from '../devices/devices.module';
import { DevicesService } from '../devices/devices.service';
import { setupApp } from '../setup-app';
import { TELEMETRY_REPOSITORY } from './constants/telemetry-repository.token';
import type { TelemetryRepository } from './interfaces/telemetry-repository.interface';
import { TelemetryModule } from './telemetry.module';
import { TelemetryService } from './telemetry.service';

/**
 * In-memory integration coverage for the telemetry seam: batch ingest,
 * cascade semantics, and bounded range queries through the real DI graph
 * (DevicesModule + TelemetryModule) with the global ValidationPipe.
 *
 * Prisma-mode integration (migrated Postgres, DATA_SOURCE=prisma) is left to
 * CI/verify with a live database; the Prisma repository mapping is covered
 * by prisma-telemetry.repository.spec.ts with a mocked PrismaService.
 */
describe('TelemetryModule (integration, in-memory)', () => {
  let app: INestApplication<App>;
  let devicesService: DevicesService;
  let telemetryService: TelemetryService;
  let telemetryRepository: TelemetryRepository;
  let portCounter = 47100;

  const baseTs = Date.now();

  const isoMinutesAgo = (minutes: number): string =>
    new Date(baseTs - minutes * 60 * 1000).toISOString();

  async function createDevice(): Promise<string> {
    const device = await devicesService.create({
      name: `Sensor ${randomUUID()}`,
      description: 'Telemetry integration fixture',
      ipAddress: '192.168.1.70',
      port: portCounter++,
    });

    return device.id;
  }

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, DevicesModule, TelemetryModule],
    }).compile();

    app = module.createNestApplication();
    setupApp(app);
    await app.init();

    devicesService = module.get<DevicesService>(DevicesService);
    telemetryService = module.get<TelemetryService>(TelemetryService);
    telemetryRepository = module.get<TelemetryRepository>(TELEMETRY_REPOSITORY);
  });

  afterAll(async () => {
    await app.close();
  });

  it('ingests a batch and serves a bounded range in ts order', async () => {
    const deviceId = await createDevice();

    const result = await telemetryService.ingest(deviceId, {
      readings: [
        { ts: isoMinutesAgo(30), metric: 'temp', value: 22.4 },
        { ts: isoMinutesAgo(20), metric: 'temp', value: 22.9 },
        { ts: isoMinutesAgo(10), metric: 'humidity', value: 61.0, unit: '%' },
      ],
    });

    expect(result).toEqual({ deviceId, count: 3 });

    const rows = await telemetryService.query(deviceId, {
      from: isoMinutesAgo(60),
      to: new Date(baseTs).toISOString(),
    });

    expect(rows.map((row) => row.value)).toEqual([22.4, 22.9, 61.0]);

    const filtered = await telemetryService.query(deviceId, {
      metric: 'temp',
      from: isoMinutesAgo(60),
      to: new Date(baseTs).toISOString(),
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.every((row) => row.metric === 'temp')).toBe(true);
  });

  it('rejects an invalid batch with 400 and stores nothing', async () => {
    const deviceId = await createDevice();

    await request(app.getHttpServer())
      .post(`/devices/${deviceId}/telemetry/batch`)
      .send({
        readings: [{ ts: 'not-a-date', metric: '', value: 'NaN' }],
      })
      .expect(400);

    const rows = await telemetryService.query(deviceId, {
      from: isoMinutesAgo(60),
      to: new Date(baseTs).toISOString(),
    });

    expect(rows).toHaveLength(0);
  });

  it('rejects unbounded queries with 400', async () => {
    const deviceId = await createDevice();

    await request(app.getHttpServer())
      .get(`/devices/${deviceId}/telemetry?limit=5000`)
      .expect(400);

    await request(app.getHttpServer())
      .get(
        `/devices/${deviceId}/telemetry?from=2026-08-01T00:00:00.000Z&to=2026-09-12T00:00:00.000Z`,
      )
      .expect(400);
  });

  it('returns 404 for telemetry on unknown devices', async () => {
    const unknownId = randomUUID();

    await request(app.getHttpServer())
      .post(`/devices/${unknownId}/telemetry/batch`)
      .send({
        readings: [{ ts: isoMinutesAgo(5), metric: 'temp', value: 21.0 }],
      })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/devices/${unknownId}/telemetry`)
      .expect(404);
  });

  it('hides readings after device delete and removes them on cleanup', async () => {
    const deviceId = await createDevice();

    await telemetryService.ingest(deviceId, {
      readings: [
        { ts: isoMinutesAgo(15), metric: 'temp', value: 23.1 },
        { ts: isoMinutesAgo(5), metric: 'temp', value: 23.4 },
      ],
    });

    await devicesService.remove(deviceId);

    await expect(
      telemetryService.query(deviceId, {
        from: isoMinutesAgo(60),
        to: new Date(baseTs).toISOString(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Prisma enforces the cascade at the FK level; the in-memory fake has no
    // FK engine, so stored rows are dropped through the repository instead.
    await expect(telemetryRepository.deleteByDeviceId(deviceId)).resolves.toBe(
      2,
    );

    await expect(
      telemetryRepository.query(deviceId, {
        metric: undefined,
        from: new Date(baseTs - 60 * 60 * 1000),
        to: new Date(baseTs),
        limit: 1000,
      }),
    ).resolves.toHaveLength(0);
  });
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from '../devices/devices.service';
import { Device } from '../devices/interfaces/device.interface';
import { TELEMETRY_REPOSITORY } from './constants/telemetry-repository.token';
import { TelemetryRepository } from './interfaces/telemetry-repository.interface';
import { TelemetryService } from './telemetry.service';

function buildDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Sensor 1',
    description: 'Telemetry fixture',
    driver: 'esp32',
    capabilities: ['riego', 'luces'],
    mqttTopic: undefined,
    ipAddress: '192.168.1.70',
    port: 80,
    status: 'online',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('TelemetryService', () => {
  let telemetryService: TelemetryService;
  let devicesService: jest.Mocked<DevicesService>;
  let telemetryRepository: jest.Mocked<TelemetryRepository>;

  const deviceId = '00000000-0000-4000-8000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        {
          provide: DevicesService,
          useValue: { findById: jest.fn() },
        },
        {
          provide: TELEMETRY_REPOSITORY,
          useValue: {
            ingestMany: jest.fn(),
            query: jest.fn(),
            deleteByDeviceId: jest.fn(),
          },
        },
      ],
    }).compile();

    telemetryService = module.get<TelemetryService>(TelemetryService);
    devicesService = module.get(DevicesService);
    telemetryRepository = module.get(TELEMETRY_REPOSITORY);

    devicesService.findById.mockResolvedValue(buildDevice());
  });

  describe('ingest', () => {
    it('stores a valid batch and returns the count', async () => {
      telemetryRepository.ingestMany.mockResolvedValue(2);

      const result = await telemetryService.ingest(deviceId, {
        readings: [
          {
            ts: '2026-09-12T10:00:00.000Z',
            metric: 'soil_moisture',
            value: 41.5,
            unit: '%',
          },
          {
            ts: '2026-09-12T10:05:00.000Z',
            metric: 'soil_moisture',
            value: 41.2,
          },
        ],
      });

      expect(result).toEqual({ deviceId, count: 2 });
      expect(telemetryRepository.ingestMany.mock.calls).toHaveLength(1);
      expect(telemetryRepository.ingestMany.mock.calls[0]?.[0]).toEqual([
        expect.objectContaining({
          deviceId,
          metric: 'soil_moisture',
          value: 41.5,
          unit: '%',
        }),
        expect.objectContaining({
          deviceId,
          metric: 'soil_moisture',
          value: 41.2,
          unit: undefined,
        }),
      ]);
    });

    it('throws 404 for unknown devices without storing anything', async () => {
      devicesService.findById.mockRejectedValue(
        new NotFoundException(`Device ${deviceId} not found`),
      );

      await expect(
        telemetryService.ingest(deviceId, {
          readings: [
            { ts: '2026-09-12T10:00:00.000Z', metric: 'temp', value: 22.1 },
          ],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(telemetryRepository.ingestMany.mock.calls).toHaveLength(0);
    });
  });

  describe('query', () => {
    it('forwards a bounded range to the repository', async () => {
      telemetryRepository.query.mockResolvedValue([]);

      await telemetryService.query(deviceId, {
        metric: 'soil_moisture',
        from: '2026-09-12T09:00:00.000Z',
        to: '2026-09-12T11:00:00.000Z',
        limit: 100,
      });

      expect(telemetryRepository.query.mock.calls).toHaveLength(1);
      expect(telemetryRepository.query.mock.calls[0]).toEqual([
        deviceId,
        {
          metric: 'soil_moisture',
          from: new Date('2026-09-12T09:00:00.000Z'),
          to: new Date('2026-09-12T11:00:00.000Z'),
          limit: 100,
        },
      ]);
    });

    it('defaults a missing window to the last 24 hours', async () => {
      telemetryRepository.query.mockResolvedValue([]);

      await telemetryService.query(deviceId, {});

      const range = telemetryRepository.query.mock.calls[0]?.[1];
      expect(range?.limit).toBe(1000);
      expect(range?.to.getTime() - range?.from.getTime()).toBe(
        24 * 60 * 60 * 1000,
      );
    });

    it('rejects limits above 1000 with 400', async () => {
      await expect(
        telemetryService.query(deviceId, {
          from: '2026-09-12T09:00:00.000Z',
          to: '2026-09-12T11:00:00.000Z',
          limit: 1001,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(telemetryRepository.query.mock.calls).toHaveLength(0);
    });

    it('rejects windows wider than 7 days with 400', async () => {
      await expect(
        telemetryService.query(deviceId, {
          from: '2026-09-01T00:00:00.000Z',
          to: '2026-09-12T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(telemetryRepository.query.mock.calls).toHaveLength(0);
    });

    it('rejects inverted and invalid ranges with 400', async () => {
      await expect(
        telemetryService.query(deviceId, {
          from: '2026-09-12T11:00:00.000Z',
          to: '2026-09-12T09:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        telemetryService.query(deviceId, { from: 'not-a-date' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(telemetryRepository.query.mock.calls).toHaveLength(0);
    });

    it('throws 404 for unknown devices without querying', async () => {
      devicesService.findById.mockRejectedValue(
        new NotFoundException(`Device ${deviceId} not found`),
      );

      await expect(
        telemetryService.query(deviceId, {
          from: '2026-09-12T09:00:00.000Z',
          to: '2026-09-12T11:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(telemetryRepository.query.mock.calls).toHaveLength(0);
    });
  });
});

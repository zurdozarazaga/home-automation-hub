import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { PrismaTelemetryRepository } from './prisma-telemetry.repository';

describe('PrismaTelemetryRepository', () => {
  let repository: PrismaTelemetryRepository;
  let prisma: {
    telemetryReading: {
      createMany: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      telemetryReading: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaTelemetryRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<PrismaTelemetryRepository>(
      PrismaTelemetryRepository,
    );
  });

  describe('ingestMany', () => {
    const inputs = [
      {
        deviceId: '00000000-0000-4000-8000-000000000001',
        ts: new Date('2026-09-12T10:00:00.000Z'),
        metric: 'soil_moisture',
        value: 41.5,
        unit: '%',
        source: undefined,
      },
    ];

    it('returns the stored count', async () => {
      prisma.telemetryReading.createMany.mockResolvedValue({ count: 1 });

      await expect(repository.ingestMany(inputs)).resolves.toBe(1);
      expect(prisma.telemetryReading.createMany.mock.calls).toHaveLength(1);
    });

    it('maps P2002 to 409', async () => {
      prisma.telemetryReading.createMany.mockRejectedValue({ code: 'P2002' });

      await expect(repository.ingestMany(inputs)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('maps P2025 to 404', async () => {
      prisma.telemetryReading.createMany.mockRejectedValue({ code: 'P2025' });

      await expect(repository.ingestMany(inputs)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('maps P2003 to 400', async () => {
      prisma.telemetryReading.createMany.mockRejectedValue({ code: 'P2003' });

      await expect(repository.ingestMany(inputs)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('maps unknown failures to 500', async () => {
      prisma.telemetryReading.createMany.mockRejectedValue(
        new Error('connection reset'),
      );

      await expect(repository.ingestMany(inputs)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('query', () => {
    const deviceId = '00000000-0000-4000-8000-000000000001';
    const range = {
      metric: 'soil_moisture',
      from: new Date('2026-09-12T09:00:00.000Z'),
      to: new Date('2026-09-12T11:00:00.000Z'),
      limit: 100,
    };

    it('queries a bounded window ordered by ts and maps nulls', async () => {
      prisma.telemetryReading.findMany.mockResolvedValue([
        {
          id: 'reading-1',
          deviceId,
          ts: new Date('2026-09-12T10:00:00.000Z'),
          metric: 'soil_moisture',
          value: 41.5,
          unit: null,
          source: null,
        },
      ]);

      const rows = await repository.query(deviceId, range);

      expect(prisma.telemetryReading.findMany).toHaveBeenCalledWith({
        where: {
          deviceId,
          metric: 'soil_moisture',
          ts: { gte: range.from, lte: range.to },
        },
        orderBy: { ts: 'asc' },
        take: 100,
      });
      expect(rows).toEqual([
        expect.objectContaining({
          id: 'reading-1',
          metric: 'soil_moisture',
          value: 41.5,
          unit: undefined,
          source: undefined,
        }),
      ]);
    });

    it('maps failures to 500', async () => {
      prisma.telemetryReading.findMany.mockRejectedValue(
        new Error('connection reset'),
      );

      await expect(repository.query(deviceId, range)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('deleteByDeviceId', () => {
    it('returns the deleted count and maps failures to 500', async () => {
      prisma.telemetryReading.deleteMany.mockResolvedValue({ count: 2 });

      await expect(
        repository.deleteByDeviceId('00000000-0000-4000-8000-000000000001'),
      ).resolves.toBe(2);

      prisma.telemetryReading.deleteMany.mockRejectedValue(
        new Error('connection reset'),
      );

      await expect(
        repository.deleteByDeviceId('00000000-0000-4000-8000-000000000001'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});

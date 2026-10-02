import { Logger } from '@nestjs/common';
import { ActionsService } from '../actions/actions.service';
import type { Device } from '../devices/interfaces/device.interface';
import { DevicesService } from '../devices/devices.service';
import {
  ACK_TIMEOUT_ERROR_MESSAGE,
  DEFAULT_BOARD_SWEEP_INTERVAL_MS,
} from './board.constants';
import {
  BoardSweepService,
  resolveBoardSweepIntervalMs,
} from './board-sweep.service';
import type { DeviceCommand } from './interfaces/device-command.interface';
import type { DeviceCommandRepository } from './interfaces/device-command-repository.interface';

const DEVICE_ID = '00000000-0000-4000-8000-000000000001';
const COMMAND_ID = '00000000-0000-4000-8000-000000000010';

function buildDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: DEVICE_ID,
    name: 'Riego Patio',
    description: 'ESP32 node',
    driver: 'esp32',
    capabilities: ['riego', 'luces'],
    ipAddress: '192.168.1.50',
    port: 80,
    macAddress: 'C0:4E:30:07:DE:10',
    status: 'online',
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildCommand(overrides: Partial<DeviceCommand> = {}): DeviceCommand {
  return {
    id: COMMAND_ID,
    deviceId: DEVICE_ID,
    action: 'turn_on',
    target: 'riego',
    endpoint: '/riego/on',
    status: 'expired',
    result: 'failed',
    errorMessage: ACK_TIMEOUT_ERROR_MESSAGE,
    createdAt: new Date(Date.now() - 180000),
    ...overrides,
  };
}

describe('BoardSweepService', () => {
  let service: BoardSweepService;
  let commandRepository: jest.Mocked<DeviceCommandRepository>;
  let devicesService: { findAll: jest.Mock; updateStatus: jest.Mock };
  let actionsService: { recordOutcome: jest.Mock };
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    commandRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      claimPendingByDevice: jest.fn(),
      acknowledge: jest.fn(),
      expireStale: jest.fn().mockResolvedValue([]),
    };
    devicesService = {
      findAll: jest.fn().mockResolvedValue([]),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    actionsService = { recordOutcome: jest.fn().mockResolvedValue(undefined) };

    service = new BoardSweepService(
      devicesService as unknown as DevicesService,
      commandRepository,
      actionsService as unknown as ActionsService,
    );

    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.DEVICE_LINK_MODE;
    delete process.env.DATA_SOURCE;
    delete process.env.BOARD_SWEEP_INTERVAL_MS;
  });

  it('expires stuck commands and logs the ack timeout as failed', async () => {
    commandRepository.expireStale.mockResolvedValue([buildCommand()]);

    await service.sweepOnce();

    expect(commandRepository.expireStale.mock.calls).toHaveLength(1);
    const [cutoff, message] = commandRepository.expireStale.mock.calls[0];
    expect(cutoff).toBeInstanceOf(Date);
    expect(message).toBe(ACK_TIMEOUT_ERROR_MESSAGE);
    expect(actionsService.recordOutcome).toHaveBeenCalledWith(
      { deviceId: DEVICE_ID, action: 'turn_on', target: 'riego' },
      { endpoint: '/riego/on', httpStatusCode: 502 },
      'failed',
      ACK_TIMEOUT_ERROR_MESSAGE,
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(ACK_TIMEOUT_ERROR_MESSAGE),
    );
  });

  it('flips only stale online devices offline', async () => {
    const stale = buildDevice({
      lastSeenAt: new Date(Date.now() - 60000),
    });
    const fresh = buildDevice({
      id: '00000000-0000-4000-8000-000000000002',
      lastSeenAt: new Date(),
    });
    const alreadyOffline = buildDevice({
      id: '00000000-0000-4000-8000-000000000003',
      status: 'offline',
      lastSeenAt: new Date(Date.now() - 600000),
    });
    const neverSeen = buildDevice({
      id: '00000000-0000-4000-8000-000000000004',
      lastSeenAt: null,
    });
    devicesService.findAll.mockResolvedValue([
      stale,
      fresh,
      alreadyOffline,
      neverSeen,
    ]);

    await service.sweepOnce();

    expect(devicesService.updateStatus).toHaveBeenCalledTimes(2);
    expect(devicesService.updateStatus).toHaveBeenCalledWith(
      stale.id,
      'offline',
    );
    expect(devicesService.updateStatus).toHaveBeenCalledWith(
      neverSeen.id,
      'offline',
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('online -> offline'),
    );
  });

  it('keeps the cycle alive when expiring commands fails', async () => {
    commandRepository.expireStale.mockRejectedValue(new Error('db down'));

    await expect(service.sweepOnce()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      'Board sweep cycle failed',
      expect.any(String),
    );
  });

  describe('lifecycle', () => {
    it('stays off when the link mode is not push', () => {
      jest.useFakeTimers();
      process.env.DATA_SOURCE = 'prisma';
      process.env.DEVICE_LINK_MODE = 'pull';

      service.onModuleInit();

      expect(jest.getTimerCount()).toBe(0);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('DEVICE_LINK_MODE'),
      );
      jest.useRealTimers();
    });

    it('stays off outside prisma mode', () => {
      jest.useFakeTimers();
      process.env.DEVICE_LINK_MODE = 'push';
      process.env.DATA_SOURCE = 'in-memory';

      service.onModuleInit();

      expect(jest.getTimerCount()).toBe(0);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('DATA_SOURCE'),
      );
      jest.useRealTimers();
    });

    it('stays off when the interval is zero', () => {
      jest.useFakeTimers();
      process.env.DEVICE_LINK_MODE = 'push';
      process.env.DATA_SOURCE = 'prisma';
      process.env.BOARD_SWEEP_INTERVAL_MS = '0';

      service.onModuleInit();

      expect(jest.getTimerCount()).toBe(0);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('BOARD_SWEEP_INTERVAL_MS'),
      );
      jest.useRealTimers();
    });

    it('starts and stops the interval in push + prisma mode', () => {
      jest.useFakeTimers();
      process.env.DEVICE_LINK_MODE = 'push';
      process.env.DATA_SOURCE = 'prisma';
      process.env.BOARD_SWEEP_INTERVAL_MS = '1000';

      service.onModuleInit();
      expect(jest.getTimerCount()).toBe(1);

      service.onModuleDestroy();
      expect(jest.getTimerCount()).toBe(0);
      jest.useRealTimers();
    });
  });
});

describe('resolveBoardSweepIntervalMs', () => {
  afterEach(() => {
    delete process.env.BOARD_SWEEP_INTERVAL_MS;
  });

  it('defaults to 30s when unset or unparsable', () => {
    expect(resolveBoardSweepIntervalMs()).toBe(DEFAULT_BOARD_SWEEP_INTERVAL_MS);

    process.env.BOARD_SWEEP_INTERVAL_MS = 'later';
    expect(resolveBoardSweepIntervalMs()).toBe(DEFAULT_BOARD_SWEEP_INTERVAL_MS);

    process.env.BOARD_SWEEP_INTERVAL_MS = '  ';
    expect(resolveBoardSweepIntervalMs()).toBe(DEFAULT_BOARD_SWEEP_INTERVAL_MS);
  });

  it('honors a positive interval', () => {
    process.env.BOARD_SWEEP_INTERVAL_MS = '1500';
    expect(resolveBoardSweepIntervalMs()).toBe(1500);
  });

  it('returns 0 to disable on zero or negative values', () => {
    process.env.BOARD_SWEEP_INTERVAL_MS = '0';
    expect(resolveBoardSweepIntervalMs()).toBe(0);

    process.env.BOARD_SWEEP_INTERVAL_MS = '-1';
    expect(resolveBoardSweepIntervalMs()).toBe(0);
  });
});

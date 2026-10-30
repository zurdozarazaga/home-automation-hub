import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ActionsService } from '../actions/actions.service';
import { DevicesService } from '../devices/devices.service';
import type { Device } from '../devices/interfaces/device.interface';
import { TelemetryService } from '../telemetry/telemetry.service';
import { BoardSyncService } from './board-sync.service';
import { DEVICE_COMMAND_REPOSITORY } from './constants/device-command-repository.token';
import type { DeviceCommand } from './interfaces/device-command.interface';
import type { DeviceCommandRepository } from './interfaces/device-command-repository.interface';

const DEVICE_ID = '00000000-0000-4000-8000-000000000001';
const COMMAND_ID = '00000000-0000-4000-8000-000000000010';
const BOARD_MAC = 'C0:4E:30:07:DE:10';

function buildDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: DEVICE_ID,
    name: 'Riego Patio',
    description: 'ESP32 node',
    driver: 'esp32',
    capabilities: ['riego', 'luces'],
    ipAddress: '192.168.1.50',
    port: 80,
    macAddress: BOARD_MAC,
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
    status: 'dispatched',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('BoardSyncService', () => {
  let service: BoardSyncService;
  let devicesService: { findByMacAddress: jest.Mock; markSeen: jest.Mock };
  let commandRepository: jest.Mocked<DeviceCommandRepository>;
  let telemetryService: { ingest: jest.Mock };
  let actionsService: { recordOutcome: jest.Mock };

  beforeEach(async () => {
    devicesService = {
      findByMacAddress: jest.fn().mockResolvedValue(buildDevice()),
      markSeen: jest.fn().mockResolvedValue(buildDevice()),
    };
    commandRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      claimPendingByDevice: jest.fn().mockResolvedValue([]),
      acknowledge: jest.fn(),
      expireStale: jest.fn(),
    };
    telemetryService = { ingest: jest.fn() };
    actionsService = { recordOutcome: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardSyncService,
        { provide: DevicesService, useValue: devicesService },
        { provide: DEVICE_COMMAND_REPOSITORY, useValue: commandRepository },
        { provide: TelemetryService, useValue: telemetryService },
        { provide: ActionsService, useValue: actionsService },
      ],
    }).compile();

    service = module.get(BoardSyncService);
  });

  it('answers 404 with a registration hint for an unknown MAC', async () => {
    devicesService.findByMacAddress.mockResolvedValue(null);

    await expect(service.sync({ mac: BOARD_MAC })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.sync({ mac: BOARD_MAC })).rejects.toThrow(/--mac/);

    expect(devicesService.markSeen).not.toHaveBeenCalled();
  });

  it('matches the board case-insensitively and marks it seen', async () => {
    await service.sync({ mac: 'c0:4e:30:07:de:10' });

    expect(devicesService.findByMacAddress).toHaveBeenCalledWith(
      'c0:4e:30:07:de:10',
    );
    expect(devicesService.markSeen).toHaveBeenCalledWith(DEVICE_ID);
  });

  it('returns claimed pending commands as summaries', async () => {
    commandRepository.claimPendingByDevice.mockResolvedValue([
      buildCommand(),
      buildCommand({
        id: '00000000-0000-4000-8000-000000000011',
        action: 'turn_off',
        target: 'luces',
        endpoint: '/luces/off',
      }),
    ]);

    const response = await service.sync({ mac: BOARD_MAC });

    const claimCall = commandRepository.claimPendingByDevice.mock.calls[0];
    expect(claimCall?.[0]).toBe(DEVICE_ID);
    expect(claimCall?.[1]).toBeInstanceOf(Date);
    expect(claimCall?.[2]).toBe(20);
    expect(response).toEqual({
      deviceId: DEVICE_ID,
      commands: [
        { id: COMMAND_ID, action: 'turn_on', target: 'riego' },
        {
          id: '00000000-0000-4000-8000-000000000011',
          action: 'turn_off',
          target: 'luces',
        },
      ],
    });
  });

  it('acks a successful command and writes the final ActionLog', async () => {
    commandRepository.findById.mockResolvedValue(buildCommand());
    commandRepository.acknowledge.mockResolvedValue(
      buildCommand({ status: 'acked', result: 'success', ackedAt: new Date() }),
    );

    await service.sync({
      mac: BOARD_MAC,
      acks: [{ id: COMMAND_ID, ok: true, httpStatus: 200 }],
    });

    expect(commandRepository.acknowledge.mock.calls).toHaveLength(1);
    const [ackId, ackInput] = commandRepository.acknowledge.mock.calls[0];
    expect(ackId).toBe(COMMAND_ID);
    expect(ackInput).toEqual(
      expect.objectContaining({ result: 'success', errorMessage: undefined }),
    );
    expect(actionsService.recordOutcome).toHaveBeenCalledWith(
      { deviceId: DEVICE_ID, action: 'turn_on', target: 'riego' },
      { endpoint: '/riego/on', httpStatusCode: 200 },
      'success',
      undefined,
    );
  });

  it('marks a failed ack and stores the board error', async () => {
    commandRepository.findById.mockResolvedValue(buildCommand());
    commandRepository.acknowledge.mockResolvedValue(
      buildCommand({ status: 'acked', result: 'failed', ackedAt: new Date() }),
    );

    await service.sync({
      mac: BOARD_MAC,
      acks: [{ id: COMMAND_ID, ok: false, httpStatus: 500 }],
    });

    expect(commandRepository.acknowledge.mock.calls).toHaveLength(1);
    const [ackId, ackInput] = commandRepository.acknowledge.mock.calls[0];
    expect(ackId).toBe(COMMAND_ID);
    expect(ackInput.result).toBe('failed');
    expect(ackInput.errorMessage).toContain('httpStatus: 500');
    expect(actionsService.recordOutcome).toHaveBeenCalledWith(
      { deviceId: DEVICE_ID, action: 'turn_on', target: 'riego' },
      { endpoint: '/riego/on', httpStatusCode: 500 },
      'failed',
      expect.stringContaining('httpStatus: 500'),
    );
  });

  it('ignores duplicate acks without logging twice', async () => {
    commandRepository.findById.mockResolvedValue(
      buildCommand({ status: 'acked', result: 'success' }),
    );

    await service.sync({
      mac: BOARD_MAC,
      acks: [{ id: COMMAND_ID, ok: true, httpStatus: 200 }],
    });

    expect(commandRepository.acknowledge.mock.calls).toHaveLength(0);
    expect(actionsService.recordOutcome).not.toHaveBeenCalled();
  });

  it('ignores acks for commands of another device', async () => {
    commandRepository.findById.mockResolvedValue(
      buildCommand({ deviceId: '00000000-0000-4000-8000-000000000099' }),
    );

    await service.sync({
      mac: BOARD_MAC,
      acks: [{ id: COMMAND_ID, ok: true, httpStatus: 200 }],
    });

    expect(commandRepository.acknowledge.mock.calls).toHaveLength(0);
    expect(actionsService.recordOutcome).not.toHaveBeenCalled();
  });

  it('ingests a valid DHT22 snapshot through the shared mapper', async () => {
    await service.sync({
      mac: BOARD_MAC,
      sensors: { temperature_c: 21.5, humidity_pct: 55, valid: true, age_s: 3 },
    });

    expect(telemetryService.ingest).toHaveBeenCalledTimes(1);
    const [deviceId, dto] = telemetryService.ingest.mock.calls[0] as [
      string,
      {
        readings: Array<{
          metric: string;
          value: number;
          unit: string;
          source: string;
        }>;
      },
    ];

    expect(deviceId).toBe(DEVICE_ID);
    expect(dto.readings).toEqual([
      expect.objectContaining({
        metric: 'temperature',
        value: 21.5,
        unit: 'celsius',
        source: 'dht22',
      }),
      expect.objectContaining({
        metric: 'humidity',
        value: 55,
        unit: 'percent',
        source: 'dht22',
      }),
    ]);
  });

  it('skips telemetry when the snapshot is invalid', async () => {
    await service.sync({ mac: BOARD_MAC, sensors: { valid: false } });

    expect(telemetryService.ingest).not.toHaveBeenCalled();
  });

  it('keeps the sync alive when telemetry ingestion fails', async () => {
    telemetryService.ingest.mockRejectedValue(new Error('db down'));

    const response = await service.sync({
      mac: BOARD_MAC,
      sensors: { temperature_c: 20, valid: true },
    });

    expect(response).toEqual({ deviceId: DEVICE_ID, commands: [] });
  });
});

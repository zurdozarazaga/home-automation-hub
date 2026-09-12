import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DEVICE_DRIVER } from '../devices/constants/driver.tokens';
import { DevicesService } from '../devices/devices.service';
import { DriverResolverService } from '../devices/drivers/driver-resolver.service';
import { Esp32Driver } from '../devices/drivers/esp32.driver';
import { Device } from '../devices/interfaces/device.interface';
import { ActionsService } from './actions.service';
import { ACTION_LOG_REPOSITORY } from './constants/action-log-repository.token';
import { ESP32_CLIENT } from './constants/esp32-client.token';
import { ActionLogRepository } from './interfaces/action-log-repository.interface';
import { Esp32Client } from './interfaces/esp32-client.interface';

function buildDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Riego 1',
    description: 'Control de riego',
    driver: 'esp32',
    capabilities: ['riego', 'luces'],
    mqttTopic: undefined,
    ipAddress: '192.168.1.80',
    port: 80,
    status: 'online',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ActionsService', () => {
  let actionsService: ActionsService;
  let devicesService: jest.Mocked<DevicesService>;
  let driverResolver: jest.Mocked<DriverResolverService>;
  let esp32Client: jest.Mocked<Esp32Client>;
  let actionLogRepository: jest.Mocked<ActionLogRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionsService,
        {
          provide: DevicesService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: DEVICE_DRIVER,
          useValue: {
            resolve: jest.fn(),
          },
        },
        {
          provide: ESP32_CLIENT,
          useValue: {
            sendAction: jest.fn(),
          },
        },
        {
          provide: ACTION_LOG_REPOSITORY,
          useValue: {
            create: jest.fn(),
            findAllByDeviceId: jest.fn(),
          },
        },
      ],
    }).compile();

    actionsService = module.get<ActionsService>(ActionsService);
    devicesService = module.get(DevicesService);
    driverResolver = module.get(DEVICE_DRIVER);
    esp32Client = module.get(ESP32_CLIENT);
    actionLogRepository = module.get(ACTION_LOG_REPOSITORY);

    driverResolver.resolve.mockImplementation(() => new Esp32Driver());
    actionLogRepository.create.mockResolvedValue({
      id: 'log-id',
      deviceId: '00000000-0000-4000-8000-000000000001',
      action: 'turn_on',
      target: 'riego',
      endpoint: '/riego/on',
      result: 'success',
      httpStatusCode: 200,
      createdAt: new Date(),
    });
  });

  it('executes action successfully', async () => {
    const device = buildDevice();

    devicesService.findById.mockResolvedValue(device);
    esp32Client.sendAction.mockResolvedValue({
      endpoint: '/riego/on',
      httpStatusCode: 200,
    });

    const result = await actionsService.execute(device.id, {
      action: 'turn_on',
      target: 'riego',
    });

    expect(result.result).toBe('success');
    expect(result.endpoint).toBe('/riego/on');
    expect(actionLogRepository.create.mock.calls).toHaveLength(1);
  });

  it('throws not found when device does not exist', async () => {
    devicesService.findById.mockRejectedValue(
      new NotFoundException('Device not found'),
    );

    await expect(
      actionsService.execute('00000000-0000-4000-8000-000000000001', {
        action: 'turn_on',
        target: 'riego',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(esp32Client.sendAction.mock.calls).toHaveLength(0);
  });

  it('throws bad gateway when esp32 client fails', async () => {
    const device = buildDevice({
      name: 'Luces 1',
      description: 'Control de luces',
      ipAddress: '192.168.1.81',
    });

    devicesService.findById.mockResolvedValue(device);
    esp32Client.sendAction.mockRejectedValue(
      new BadGatewayException('Device unreachable'),
    );

    await expect(
      actionsService.execute(device.id, {
        action: 'turn_off',
        target: 'luces',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(actionLogRepository.create.mock.calls).toHaveLength(1);
    expect(actionLogRepository.create.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        result: 'failed',
        endpoint: '/luces/off',
        httpStatusCode: 502,
      }),
    );
  });

  it('maps target and action to expected endpoint', async () => {
    const device = buildDevice({
      name: 'Riego 2',
      description: 'Control secundario',
      ipAddress: '192.168.1.82',
    });

    devicesService.findById.mockResolvedValue(device);
    esp32Client.sendAction.mockRejectedValue(
      new BadGatewayException('Device unreachable'),
    );

    await expect(
      actionsService.execute(device.id, {
        action: 'turn_on',
        target: 'luces',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(actionLogRepository.create.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        endpoint: '/luces/on',
      }),
    );
  });

  it('rejects unsupported targets with 400 without dispatch or log', async () => {
    const device = buildDevice();

    devicesService.findById.mockResolvedValue(device);

    await expect(
      actionsService.execute(device.id, {
        action: 'turn_on',
        target: 'cortina',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(esp32Client.sendAction.mock.calls).toHaveLength(0);
    expect(actionLogRepository.create.mock.calls).toHaveLength(0);
  });

  it('rejects capability-listed targets the driver cannot serve', async () => {
    const device = buildDevice({ capabilities: ['riego', 'luces', 'cortina'] });

    devicesService.findById.mockResolvedValue(device);

    await expect(
      actionsService.execute(device.id, {
        action: 'turn_on',
        target: 'cortina',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(esp32Client.sendAction.mock.calls).toHaveLength(0);
    expect(actionLogRepository.create.mock.calls).toHaveLength(0);
  });

  it('fails closed with 400 for unknown drivers without device contact', async () => {
    const device = buildDevice({ driver: 'plc-s7' });

    devicesService.findById.mockResolvedValue(device);
    driverResolver.resolve.mockImplementation(() => {
      throw new BadRequestException("Unknown device driver 'plc-s7'");
    });

    await expect(
      actionsService.execute(device.id, {
        action: 'turn_on',
        target: 'riego',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(esp32Client.sendAction.mock.calls).toHaveLength(0);
    expect(actionLogRepository.create.mock.calls).toHaveLength(0);
  });
});

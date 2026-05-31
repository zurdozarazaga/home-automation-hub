import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from '../devices/devices.service';
import { ActionsService } from './actions.service';
import { ACTION_LOG_REPOSITORY } from './constants/action-log-repository.token';
import { ESP32_CLIENT } from './constants/esp32-client.token';
import { ActionLogRepository } from './interfaces/action-log-repository.interface';
import { Esp32Client } from './interfaces/esp32-client.interface';

describe('ActionsService', () => {
  let actionsService: ActionsService;
  let devicesService: jest.Mocked<DevicesService>;
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
    esp32Client = module.get(ESP32_CLIENT);
    actionLogRepository = module.get(ACTION_LOG_REPOSITORY);

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
    const device = {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Riego 1',
      description: 'Control de riego',
      ipAddress: '192.168.1.80',
      port: 80,
      status: 'online' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

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
    const device = {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Luces 1',
      description: 'Control de luces',
      ipAddress: '192.168.1.81',
      port: 80,
      status: 'online' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

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
    const device = {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Riego 2',
      description: 'Control secundario',
      ipAddress: '192.168.1.82',
      port: 80,
      status: 'online' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

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
});

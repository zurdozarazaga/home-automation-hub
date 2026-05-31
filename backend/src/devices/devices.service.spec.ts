import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DEVICE_REPOSITORY } from './constants/device-repository.token';
import { DevicesService } from './devices.service';
import { InMemoryDeviceRepository } from './repositories/in-memory-device.repository';

describe('DevicesService', () => {
  let devicesService: DevicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        {
          provide: DEVICE_REPOSITORY,
          useClass: InMemoryDeviceRepository,
        },
      ],
    }).compile();

    devicesService = module.get<DevicesService>(DevicesService);
  });

  it('creates and returns a device', async () => {
    const created = await devicesService.create({
      name: 'Riego Patio',
      description: 'Controla riego del patio',
      ipAddress: '192.168.1.10',
      port: 80,
    });

    expect(created.id).toBeDefined();
    expect(created.status).toBe('offline');
  });

  it('rejects duplicate name', async () => {
    await devicesService.create({
      name: 'Luces Terraza',
      description: 'Controla luces',
      ipAddress: '192.168.1.20',
      port: 80,
    });

    await expect(
      devicesService.create({
        name: 'Luces Terraza',
        description: 'Segundo dispositivo',
        ipAddress: '192.168.1.21',
        port: 80,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects duplicate ip and port', async () => {
    await devicesService.create({
      name: 'Bomba 1',
      description: 'Primera bomba',
      ipAddress: '192.168.1.30',
      port: 8080,
    });

    await expect(
      devicesService.create({
        name: 'Bomba 2',
        description: 'Segunda bomba',
        ipAddress: '192.168.1.30',
        port: 8080,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates an existing device', async () => {
    const created = await devicesService.create({
      name: 'Sensor Riego',
      description: 'Nodo principal',
      ipAddress: '192.168.1.50',
      port: 3000,
    });

    const updated = await devicesService.update(created.id, {
      name: 'Sensor Riego Central',
      status: 'online',
    });

    expect(updated.name).toBe('Sensor Riego Central');
    expect(updated.status).toBe('online');
  });

  it('throws not found when querying unknown id', async () => {
    await expect(
      devicesService.findById('00000000-0000-4000-8000-000000000001'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes an existing device', async () => {
    const created = await devicesService.create({
      name: 'Reflector Jardin',
      description: 'Luz principal',
      ipAddress: '192.168.1.60',
      port: 80,
    });

    await devicesService.remove(created.id);

    await expect(devicesService.findById(created.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

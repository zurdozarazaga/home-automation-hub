import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DEVICE_REPOSITORY } from './constants/device-repository.token';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import type { DeviceRepository } from './interfaces/device-repository.interface';
import type { Device } from './interfaces/device.interface';

@Injectable()
export class DevicesService {
  constructor(
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: DeviceRepository,
  ) {}

  async findAll(): Promise<Device[]> {
    return this.deviceRepository.findAll();
  }

  async findById(id: string): Promise<Device> {
    const device = await this.deviceRepository.findById(id);
    if (!device) {
      throw new NotFoundException(`Device ${id} not found`);
    }

    return device;
  }

  async create(createDeviceDto: CreateDeviceDto): Promise<Device> {
    await this.ensureUniqueName(createDeviceDto.name);

    if (
      createDeviceDto.ipAddress !== undefined &&
      createDeviceDto.port !== undefined
    ) {
      await this.ensureUniqueNetwork(
        createDeviceDto.ipAddress,
        createDeviceDto.port,
      );
    }

    return this.deviceRepository.create({
      name: createDeviceDto.name,
      description: createDeviceDto.description,
      driver: createDeviceDto.driver,
      capabilities: createDeviceDto.capabilities,
      mqttTopic: createDeviceDto.mqttTopic,
      ipAddress: createDeviceDto.ipAddress,
      port: createDeviceDto.port,
    });
  }

  async update(id: string, updateDeviceDto: UpdateDeviceDto): Promise<Device> {
    const existingDevice = await this.findById(id);

    if (updateDeviceDto.name && updateDeviceDto.name !== existingDevice.name) {
      await this.ensureUniqueName(updateDeviceDto.name, id);
    }

    const nextIpAddress = updateDeviceDto.ipAddress ?? existingDevice.ipAddress;
    const nextPort = updateDeviceDto.port ?? existingDevice.port;
    const networkChanged =
      nextIpAddress !== existingDevice.ipAddress ||
      nextPort !== existingDevice.port;

    if (networkChanged && nextIpAddress != null && nextPort != null) {
      await this.ensureUniqueNetwork(nextIpAddress, nextPort, id);
    }

    const updatedDevice = await this.deviceRepository.update(
      id,
      updateDeviceDto,
    );
    if (!updatedDevice) {
      throw new NotFoundException(`Device ${id} not found`);
    }

    return updatedDevice;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.deviceRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Device ${id} not found`);
    }
  }

  private async ensureUniqueName(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existingDevice = await this.deviceRepository.findByName(name);

    if (existingDevice && existingDevice.id !== excludeId) {
      throw new ConflictException(`A device named ${name} already exists`);
    }
  }

  private async ensureUniqueNetwork(
    ipAddress: string,
    port: number,
    excludeId?: string,
  ): Promise<void> {
    const existingDevice = await this.deviceRepository.findByNetwork(
      ipAddress,
      port,
    );

    if (existingDevice && existingDevice.id !== excludeId) {
      throw new ConflictException(
        `A device with address ${ipAddress}:${port} already exists`,
      );
    }
  }
}

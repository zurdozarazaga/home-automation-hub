import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DeviceRepository } from '../interfaces/device-repository.interface';
import {
  CreateDeviceInput,
  Device,
  UpdateDeviceInput,
} from '../interfaces/device.interface';

@Injectable()
export class InMemoryDeviceRepository implements DeviceRepository {
  private readonly devices = new Map<string, Device>();

  findAll(): Promise<Device[]> {
    return Promise.resolve(Array.from(this.devices.values()));
  }

  findById(id: string): Promise<Device | null> {
    return Promise.resolve(this.devices.get(id) ?? null);
  }

  findByName(name: string): Promise<Device | null> {
    const normalizedName = name.trim().toLowerCase();

    for (const device of this.devices.values()) {
      if (device.name.trim().toLowerCase() === normalizedName) {
        return Promise.resolve(device);
      }
    }

    return Promise.resolve(null);
  }

  findByNetwork(ipAddress: string, port: number): Promise<Device | null> {
    for (const device of this.devices.values()) {
      if (device.ipAddress === ipAddress && device.port === port) {
        return Promise.resolve(device);
      }
    }

    return Promise.resolve(null);
  }

  create(input: CreateDeviceInput): Promise<Device> {
    const now = new Date();
    const device: Device = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      ipAddress: input.ipAddress,
      port: input.port,
      status: 'offline',
      createdAt: now,
      updatedAt: now,
    };

    this.devices.set(device.id, device);
    return Promise.resolve(device);
  }

  update(id: string, input: UpdateDeviceInput): Promise<Device | null> {
    const existingDevice = this.devices.get(id);
    if (!existingDevice) {
      return Promise.resolve(null);
    }

    const updatedDevice: Device = {
      ...existingDevice,
      ...input,
      updatedAt: new Date(),
    };

    this.devices.set(id, updatedDevice);
    return Promise.resolve(updatedDevice);
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.devices.delete(id));
  }
}

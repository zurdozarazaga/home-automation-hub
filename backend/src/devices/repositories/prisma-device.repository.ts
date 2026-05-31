import { Injectable, NotImplementedException } from '@nestjs/common';
import { DeviceRepository } from '../interfaces/device-repository.interface';
import {
  CreateDeviceInput,
  Device,
  UpdateDeviceInput,
} from '../interfaces/device.interface';

@Injectable()
export class PrismaDeviceRepository implements DeviceRepository {
  findAll(): Promise<Device[]> {
    // TODO(prisma): Replace with prisma.device.findMany().
    throw new NotImplementedException(
      'PrismaDeviceRepository is not implemented yet. Use DATA_SOURCE=in-memory.',
    );
  }

  findById(id: string): Promise<Device | null> {
    void id;
    // TODO(prisma): Replace with prisma.device.findUnique({ where: { id } }).
    throw new NotImplementedException(
      'PrismaDeviceRepository is not implemented yet. Use DATA_SOURCE=in-memory.',
    );
  }

  findByName(name: string): Promise<Device | null> {
    void name;
    // TODO(prisma): Replace with prisma.device.findUnique({ where: { name } }).
    throw new NotImplementedException(
      'PrismaDeviceRepository is not implemented yet. Use DATA_SOURCE=in-memory.',
    );
  }

  findByNetwork(ipAddress: string, port: number): Promise<Device | null> {
    void ipAddress;
    void port;
    // TODO(prisma): Replace with prisma.device.findFirst({ where: { ipAddress, port } }).
    throw new NotImplementedException(
      'PrismaDeviceRepository is not implemented yet. Use DATA_SOURCE=in-memory.',
    );
  }

  create(input: CreateDeviceInput): Promise<Device> {
    void input;
    // TODO(prisma): Replace with prisma.device.create().
    throw new NotImplementedException(
      'PrismaDeviceRepository is not implemented yet. Use DATA_SOURCE=in-memory.',
    );
  }

  update(id: string, input: UpdateDeviceInput): Promise<Device | null> {
    void id;
    void input;
    // TODO(prisma): Replace with prisma.device.update().
    throw new NotImplementedException(
      'PrismaDeviceRepository is not implemented yet. Use DATA_SOURCE=in-memory.',
    );
  }

  delete(id: string): Promise<boolean> {
    void id;
    // TODO(prisma): Replace with prisma.device.delete().
    throw new NotImplementedException(
      'PrismaDeviceRepository is not implemented yet. Use DATA_SOURCE=in-memory.',
    );
  }
}

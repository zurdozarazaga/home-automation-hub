import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DeviceRepository } from '../interfaces/device-repository.interface';
import {
  CreateDeviceInput,
  Device,
  DeviceStatus,
  UpdateDeviceInput,
} from '../interfaces/device.interface';

@Injectable()
export class PrismaDeviceRepository implements DeviceRepository {
  private readonly logger = new Logger(PrismaDeviceRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Device[]> {
    try {
      const devices = await this.prisma.device.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return devices.map((device) => this.mapDevice(device));
    } catch (error) {
      this.logger.error('Failed to fetch devices', error);
      throw new InternalServerErrorException('Failed to fetch devices');
    }
  }

  async findById(id: string): Promise<Device | null> {
    try {
      const device = await this.prisma.device.findUnique({
        where: { id },
      });

      return device ? this.mapDevice(device) : null;
    } catch (error) {
      this.logger.error(`Failed to fetch device by id: ${id}`, error);
      throw new InternalServerErrorException('Failed to fetch device by id');
    }
  }

  async findByName(name: string): Promise<Device | null> {
    try {
      const device = await this.prisma.device.findUnique({
        where: { name },
      });

      return device ? this.mapDevice(device) : null;
    } catch (error) {
      this.logger.error(`Failed to fetch device by name: ${name}`, error);
      throw new InternalServerErrorException('Failed to fetch device by name');
    }
  }

  async findByNetwork(ipAddress: string, port: number): Promise<Device | null> {
    try {
      const device = await this.prisma.device.findUnique({
        where: {
          ipAddress_port: {
            ipAddress,
            port,
          },
        },
      });

      return device ? this.mapDevice(device) : null;
    } catch (error) {
      this.logger.error(
        `Failed to fetch device by network: ${ipAddress}:${port}`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to fetch device by network',
      );
    }
  }

  async create(input: CreateDeviceInput): Promise<Device> {
    try {
      const created = await this.prisma.device.create({
        data: {
          name: input.name,
          description: input.description,
          ipAddress: input.ipAddress,
          port: input.port,
          status: 'offline',
        },
      });

      return this.mapDevice(created);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A device with the same name or network address already exists',
        );
      }

      this.logger.error(
        `Failed to create device: ${input.name} (${input.ipAddress}:${input.port})`,
        error,
      );
      throw new InternalServerErrorException('Failed to create device');
    }
  }

  async update(id: string, input: UpdateDeviceInput): Promise<Device | null> {
    try {
      const updated = await this.prisma.device.update({
        where: { id },
        data: input,
      });

      return this.mapDevice(updated);
    } catch (error) {
      if (this.isRecordNotFoundError(error)) {
        return null;
      }

      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A device with the same name or network address already exists',
        );
      }

      this.logger.error(`Failed to update device: ${id}`, error);
      throw new InternalServerErrorException('Failed to update device');
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.device.delete({
        where: { id },
      });

      return true;
    } catch (error) {
      if (this.isRecordNotFoundError(error)) {
        return false;
      }

      this.logger.error(`Failed to delete device: ${id}`, error);
      throw new InternalServerErrorException('Failed to delete device');
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return this.getPrismaErrorCode(error) === 'P2002';
  }

  private isRecordNotFoundError(error: unknown): boolean {
    return this.getPrismaErrorCode(error) === 'P2025';
  }

  private getPrismaErrorCode(error: unknown): string | null {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return null;
    }

    const code = (error as { code?: unknown }).code;
    if (typeof code !== 'string') {
      return null;
    }

    return code;
  }

  private mapDevice(device: {
    id: string;
    name: string;
    description: string;
    ipAddress: string;
    port: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): Device {
    const status = this.parseDeviceStatus(device.status);

    return {
      id: device.id,
      name: device.name,
      description: device.description,
      ipAddress: device.ipAddress,
      port: device.port,
      status,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }

  private parseDeviceStatus(status: string): DeviceStatus {
    if (status === 'online' || status === 'offline') {
      return status;
    }

    this.logger.error(`Invalid device status found in database: ${status}`);
    throw new InternalServerErrorException('Invalid device status in database');
  }
}

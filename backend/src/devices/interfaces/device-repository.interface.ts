import {
  CreateDeviceInput,
  Device,
  UpdateDeviceInput,
} from './device.interface';

export interface DeviceRepository {
  findAll(): Promise<Device[]>;
  findById(id: string): Promise<Device | null>;
  findByName(name: string): Promise<Device | null>;
  findByNetwork(ipAddress: string, port: number): Promise<Device | null>;
  create(input: CreateDeviceInput): Promise<Device>;
  update(id: string, input: UpdateDeviceInput): Promise<Device | null>;
  delete(id: string): Promise<boolean>;
}

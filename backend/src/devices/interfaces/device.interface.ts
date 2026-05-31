export type DeviceStatus = 'online' | 'offline';

export interface Device {
  id: string;
  name: string;
  description: string;
  ipAddress: string;
  port: number;
  status: DeviceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDeviceInput {
  name: string;
  description: string;
  ipAddress: string;
  port: number;
}

export interface UpdateDeviceInput {
  name?: string;
  description?: string;
  ipAddress?: string;
  port?: number;
  status?: DeviceStatus;
}

export type DeviceStatus = 'online' | 'offline';

export interface Device {
  id: string;
  name: string;
  description: string;
  driver: string;
  capabilities: string[];
  mqttTopic?: string;
  ipAddress: string | null;
  port: number | null;
  status: DeviceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDeviceInput {
  name: string;
  description: string;
  driver?: string;
  capabilities?: string[];
  mqttTopic?: string;
  ipAddress?: string;
  port?: number;
}

export interface UpdateDeviceInput {
  name?: string;
  description?: string;
  driver?: string;
  capabilities?: string[];
  mqttTopic?: string;
  ipAddress?: string;
  port?: number;
  status?: DeviceStatus;
}

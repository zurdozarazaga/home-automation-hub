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
  /**
   * Board identity for the push link (POST /board/sync). Null for devices
   * registered before MAC tracking or not registered with `--mac` yet.
   */
  macAddress: string | null;
  status: DeviceStatus;
  /** Last successful board sync; null until the board reaches out. */
  lastSeenAt: Date | null;
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
  macAddress?: string;
}

export interface UpdateDeviceInput {
  name?: string;
  description?: string;
  driver?: string;
  capabilities?: string[];
  mqttTopic?: string;
  ipAddress?: string;
  port?: number;
  macAddress?: string;
  status?: DeviceStatus;
  lastSeenAt?: Date;
}

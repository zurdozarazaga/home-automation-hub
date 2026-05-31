import { Controller, Get } from '@nestjs/common';
import { DevicesService } from '../devices/devices.service';

interface ApiHealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
  uptimeSeconds: number;
}

interface DevicesHealthResponse {
  status: 'ok';
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  checkedAt: string;
}

@Controller('health')
export class HealthController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  getApiHealth(): ApiHealthResponse {
    return {
      status: 'ok',
      service: 'home-automation-hub-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Number(process.uptime().toFixed(0)),
    };
  }

  @Get('devices')
  async getDevicesHealth(): Promise<DevicesHealthResponse> {
    const devices = await this.devicesService.findAll();
    const onlineDevices = devices.filter(
      (device) => device.status === 'online',
    ).length;

    return {
      status: 'ok',
      totalDevices: devices.length,
      onlineDevices,
      offlineDevices: devices.length - onlineDevices,
      checkedAt: new Date().toISOString(),
    };
  }
}

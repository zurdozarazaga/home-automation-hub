import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { resolveDeviceHttpTimeoutMs } from '../common/http/device-http';
import { DevicesService } from '../devices/devices.service';
import type {
  Device,
  DeviceStatus,
} from '../devices/interfaces/device.interface';
import type { TelemetryReadingDto } from '../telemetry/dto/ingest-telemetry.dto';
import { TelemetryService } from '../telemetry/telemetry.service';
import type { DeviceEstadoResponse } from './interfaces/device-estado.interface';

export const DEFAULT_DEVICE_POLL_INTERVAL_MS = 30000;

type PollableDevice = Device & { ipAddress: string; port: number };

/**
 * Interval in ms. `<= 0` disables the poller; unset or invalid values fall
 * back to the 30s default.
 */
export function resolveDevicePollIntervalMs(): number {
  const raw = process.env.DEVICE_POLL_INTERVAL_MS;

  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_DEVICE_POLL_INTERVAL_MS;
  }

  const intervalMs = Number(raw);

  if (!Number.isFinite(intervalMs)) {
    return DEFAULT_DEVICE_POLL_INTERVAL_MS;
  }

  return intervalMs > 0 ? intervalMs : 0;
}

/**
 * Pull-based device monitoring (no firmware changes).
 *
 * Every cycle it calls GET /estado on each ESP32 device: a reachable board
 * becomes `online` and its DHT22 snapshot is ingested as telemetry; an
 * unreachable board becomes `offline`. Only status transitions are logged.
 *
 * Active only with DATA_SOURCE=prisma so in-memory local runs never touch
 * the network; `DEVICE_POLL_INTERVAL_MS=0` disables it (e2e uses this).
 */
@Injectable()
export class DevicePollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DevicePollerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private cycleRunning = false;

  constructor(
    private readonly devicesService: DevicesService,
    private readonly telemetryService: TelemetryService,
  ) {}

  onModuleInit(): void {
    if (process.env.DATA_SOURCE !== 'prisma') {
      this.logger.log('Device poller disabled (DATA_SOURCE is not prisma)');
      return;
    }

    const intervalMs = resolveDevicePollIntervalMs();

    if (intervalMs === 0) {
      this.logger.log('Device poller disabled (DEVICE_POLL_INTERVAL_MS <= 0)');
      return;
    }

    this.timer = setInterval(() => void this.pollOnce(), intervalMs);
    this.logger.log(`Device poller started (every ${intervalMs}ms)`);

    // First cycle right away so status is accurate after a restart.
    void this.pollOnce();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async pollOnce(): Promise<void> {
    if (this.cycleRunning) {
      return;
    }

    this.cycleRunning = true;

    try {
      const devices = await this.devicesService.findAll();
      const targets = devices.filter((device): device is PollableDevice =>
        this.isPollable(device),
      );
      const results = await Promise.allSettled(
        targets.map((device) => this.pollDevice(device)),
      );

      for (const result of results) {
        if (result.status === 'rejected') {
          this.logger.error(
            'Device poll failed unexpectedly',
            result.reason instanceof Error
              ? result.reason.stack
              : String(result.reason),
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Device poll cycle failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.cycleRunning = false;
    }
  }

  private isPollable(device: Device): device is PollableDevice {
    return (
      device.driver === 'esp32' &&
      device.ipAddress !== null &&
      device.port !== null
    );
  }

  private async pollDevice(device: PollableDevice): Promise<void> {
    const url = `http://${device.ipAddress}:${device.port}/estado`;
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(resolveDeviceHttpTimeoutMs()),
      });
    } catch {
      // Board unreachable or timed out: expected while it is unplugged.
      await this.applyStatus(device, 'offline');
      return;
    }

    if (!response.ok) {
      await this.applyStatus(device, 'offline');
      return;
    }

    await this.applyStatus(device, 'online');
    await this.pullTelemetry(device, response);
  }

  private async applyStatus(
    device: Device,
    status: DeviceStatus,
  ): Promise<void> {
    if (device.status === status) {
      return;
    }

    const previousStatus = device.status;
    await this.devicesService.updateStatus(device.id, status);
    this.logger.log(
      `Device ${device.name} (${device.id}) status ${previousStatus} -> ${status}`,
    );
  }

  private async pullTelemetry(
    device: PollableDevice,
    response: Response,
  ): Promise<void> {
    let payload: DeviceEstadoResponse;

    try {
      payload = (await response.json()) as DeviceEstadoResponse;
    } catch {
      this.logger.warn(
        `Device ${device.id} returned a non-JSON /estado body; telemetry skipped`,
      );
      return;
    }

    const sensors = payload.sensors;

    if (!sensors || sensors.valid !== true) {
      return;
    }

    const ts = new Date().toISOString();
    const readings: TelemetryReadingDto[] = [];

    if (typeof sensors.temperature_c === 'number') {
      readings.push({
        ts,
        metric: 'temperature',
        value: sensors.temperature_c,
        unit: 'celsius',
        source: 'dht22',
      });
    }

    if (typeof sensors.humidity_pct === 'number') {
      readings.push({
        ts,
        metric: 'humidity',
        value: sensors.humidity_pct,
        unit: 'percent',
        source: 'dht22',
      });
    }

    if (readings.length === 0) {
      return;
    }

    try {
      await this.telemetryService.ingest(device.id, { readings });
    } catch (error) {
      this.logger.warn(
        `Failed to ingest telemetry from device ${device.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}

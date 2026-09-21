import { Logger } from '@nestjs/common';
import { DevicesService } from '../devices/devices.service';
import type { Device } from '../devices/interfaces/device.interface';
import { TelemetryService } from '../telemetry/telemetry.service';
import {
  DevicePollerService,
  resolveDevicePollIntervalMs,
} from './device-poller.service';

function buildDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 'device-1',
    name: 'Riego Patio',
    description: 'ESP32 node',
    driver: 'esp32',
    capabilities: ['riego', 'luces'],
    ipAddress: '192.168.1.50',
    port: 80,
    status: 'offline',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('DevicePollerService', () => {
  let service: DevicePollerService;
  let devicesService: { findAll: jest.Mock; updateStatus: jest.Mock };
  let telemetryService: { ingest: jest.Mock };
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const useDevices = (devices: Device[]): void => {
    devicesService.findAll.mockImplementation(() => Promise.resolve(devices));
    devicesService.updateStatus.mockImplementation(
      (id: string, status: Device['status']) => {
        const device = devices.find((candidate) => candidate.id === id);
        if (device) {
          device.status = status;
        }
        return Promise.resolve();
      },
    );
  };

  beforeEach(() => {
    devicesService = { findAll: jest.fn(), updateStatus: jest.fn() };
    telemetryService = {
      ingest: jest.fn().mockResolvedValue({ deviceId: 'device-1', count: 2 }),
    };

    service = new DevicePollerService(
      devicesService as unknown as DevicesService,
      telemetryService as unknown as TelemetryService,
    );

    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.restoreAllMocks();
    delete process.env.DATA_SOURCE;
    delete process.env.DEVICE_POLL_INTERVAL_MS;
    delete process.env.ESP32_HTTP_TIMEOUT_MS;
  });

  it('marks a reachable board online and ingests DHT22 telemetry', async () => {
    useDevices([buildDevice()]);
    fetchSpy.mockResolvedValue(
      jsonResponse({
        status: 'ok',
        sensors: { temperature_c: 21.5, humidity_pct: 55.2, valid: true },
      }),
    );

    await service.pollOnce();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://192.168.1.50:80/estado');
    expect(init.method).toBe('GET');
    expect(init.signal).toBeInstanceOf(AbortSignal);

    expect(devicesService.updateStatus).toHaveBeenCalledWith(
      'device-1',
      'online',
    );
    expect(telemetryService.ingest).toHaveBeenCalledTimes(1);

    const [deviceId, dto] = telemetryService.ingest.mock.calls[0] as [
      string,
      {
        readings: Array<{
          ts: string;
          metric: string;
          value: number;
          unit: string;
          source: string;
        }>;
      },
    ];
    expect(deviceId).toBe('device-1');
    expect(dto.readings).toEqual([
      expect.objectContaining({
        metric: 'temperature',
        value: 21.5,
        unit: 'celsius',
        source: 'dht22',
      }),
      expect.objectContaining({
        metric: 'humidity',
        value: 55.2,
        unit: 'percent',
        source: 'dht22',
      }),
    ]);
    const ts = new Date(dto.readings[0].ts).getTime();
    expect(Number.isNaN(ts)).toBe(false);
    expect(Math.abs(Date.now() - ts)).toBeLessThan(5000);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('offline -> online'),
    );
  });

  it('stays online without ingesting when the sensor snapshot is invalid', async () => {
    useDevices([buildDevice()]);
    fetchSpy.mockResolvedValue(
      jsonResponse({ status: 'ok', sensors: { valid: false } }),
    );

    await service.pollOnce();

    expect(devicesService.updateStatus).toHaveBeenCalledWith(
      'device-1',
      'online',
    );
    expect(telemetryService.ingest).not.toHaveBeenCalled();
  });

  it('marks a timed-out board offline and logs the transition once', async () => {
    useDevices([buildDevice({ status: 'online' })]);
    fetchSpy.mockRejectedValue(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      ),
    );

    await service.pollOnce();
    await service.pollOnce();

    expect(devicesService.updateStatus).toHaveBeenCalledTimes(1);
    expect(devicesService.updateStatus).toHaveBeenCalledWith(
      'device-1',
      'offline',
    );
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('online -> offline'),
    );
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('does not spam logs or writes when the status does not change', async () => {
    useDevices([buildDevice()]);
    fetchSpy.mockResolvedValue(
      jsonResponse({ status: 'ok', sensors: { valid: false } }),
    );

    await service.pollOnce();
    await service.pollOnce();
    await service.pollOnce();

    expect(devicesService.updateStatus).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('skips devices that are not esp32 or lack a network address', async () => {
    useDevices([
      buildDevice({
        id: 'mqtt-1',
        driver: 'mqtt-relay',
        ipAddress: null,
        port: null,
      }),
      buildDevice({ id: 'no-network', ipAddress: null, port: null }),
    ]);
    fetchSpy.mockResolvedValue(jsonResponse({}));

    await service.pollOnce();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(devicesService.updateStatus).not.toHaveBeenCalled();
  });

  describe('lifecycle', () => {
    beforeEach(() => {
      useDevices([]);
    });

    it('stays off outside prisma mode', () => {
      jest.useFakeTimers();
      process.env.DATA_SOURCE = 'in-memory';
      process.env.DEVICE_POLL_INTERVAL_MS = '1000';

      service.onModuleInit();

      expect(jest.getTimerCount()).toBe(0);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('DATA_SOURCE'),
      );
      jest.useRealTimers();
    });

    it('stays off when the interval is zero or negative', () => {
      jest.useFakeTimers();
      process.env.DATA_SOURCE = 'prisma';
      process.env.DEVICE_POLL_INTERVAL_MS = '0';

      service.onModuleInit();
      expect(jest.getTimerCount()).toBe(0);

      process.env.DEVICE_POLL_INTERVAL_MS = '-5';
      service.onModuleInit();
      expect(jest.getTimerCount()).toBe(0);
      jest.useRealTimers();
    });

    it('starts and stops the interval in prisma mode', () => {
      jest.useFakeTimers();
      process.env.DATA_SOURCE = 'prisma';
      process.env.DEVICE_POLL_INTERVAL_MS = '1000';

      service.onModuleInit();
      expect(jest.getTimerCount()).toBe(1);

      service.onModuleDestroy();
      expect(jest.getTimerCount()).toBe(0);
      jest.useRealTimers();
    });
  });
});

describe('resolveDevicePollIntervalMs', () => {
  afterEach(() => {
    delete process.env.DEVICE_POLL_INTERVAL_MS;
  });

  it('defaults to 30s when unset or unparsable', () => {
    expect(resolveDevicePollIntervalMs()).toBe(30000);

    process.env.DEVICE_POLL_INTERVAL_MS = 'later';
    expect(resolveDevicePollIntervalMs()).toBe(30000);

    process.env.DEVICE_POLL_INTERVAL_MS = '  ';
    expect(resolveDevicePollIntervalMs()).toBe(30000);
  });

  it('honors a positive interval', () => {
    process.env.DEVICE_POLL_INTERVAL_MS = '1500';
    expect(resolveDevicePollIntervalMs()).toBe(1500);
  });

  it('returns 0 to disable on zero or negative values', () => {
    process.env.DEVICE_POLL_INTERVAL_MS = '0';
    expect(resolveDevicePollIntervalMs()).toBe(0);

    process.env.DEVICE_POLL_INTERVAL_MS = '-1';
    expect(resolveDevicePollIntervalMs()).toBe(0);
  });
});

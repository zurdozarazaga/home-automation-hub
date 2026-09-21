import { BadGatewayException, Logger } from '@nestjs/common';
import {
  DEFAULT_DEVICE_HTTP_TIMEOUT_MS,
  resolveDeviceHttpTimeoutMs,
} from '../../common/http/device-http';
import type { DriverResolverService } from '../../devices/drivers/driver-resolver.service';
import type { Device } from '../../devices/interfaces/device.interface';
import { HttpTransportService } from './http-transport.service';

function buildDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Riego 1',
    description: 'Control de riego',
    driver: 'esp32',
    capabilities: ['riego', 'luces'],
    mqttTopic: undefined,
    ipAddress: '192.168.1.80',
    port: 80,
    status: 'online',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('HttpTransportService', () => {
  let service: HttpTransportService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    const driverResolver = {
      resolve: jest.fn().mockReturnValue({
        name: 'esp32',
        transport: 'http',
        supports: () => true,
        resolveEndpoint: () => '/riego/on',
      }),
    } as unknown as DriverResolverService;

    service = new HttpTransportService(driverResolver);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.restoreAllMocks();
    delete process.env.ESP32_HTTP_TIMEOUT_MS;
  });

  it('sends the command with an abort timeout', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const device = buildDevice();

    const result = await service.send(device, {
      deviceId: device.id,
      action: 'turn_on',
      target: 'riego',
    });

    expect(result).toEqual({ endpoint: '/riego/on', httpStatusCode: 200 });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://192.168.1.80:80/riego/on');
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps a timed-out request to a logged 502', async () => {
    fetchSpy.mockRejectedValue(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      ),
    );
    const device = buildDevice();
    const loggerSpy = jest.spyOn(
      (service as unknown as { logger: Logger }).logger,
      'error',
    );

    await expect(
      service.send(device, {
        deviceId: device.id,
        action: 'turn_on',
        target: 'riego',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(loggerSpy).toHaveBeenCalledTimes(1);
    const message = String(loggerSpy.mock.calls[0]?.[0]);
    expect(message).toContain(device.id);
    expect(message).toContain('timed out after 5000ms');
    expect(message).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('maps an unreachable device to a logged 502', async () => {
    fetchSpy.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const device = buildDevice();
    const loggerSpy = jest.spyOn(
      (service as unknown as { logger: Logger }).logger,
      'error',
    );

    await expect(
      service.send(device, {
        deviceId: device.id,
        action: 'turn_on',
        target: 'riego',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    const message = String(loggerSpy.mock.calls[0]?.[0]);
    expect(message).toContain(device.id);
    expect(message).toContain('is unreachable');
  });

  it('maps a non-ok device response to 502 without a transport error log', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), { status: 500 }),
    );
    const device = buildDevice();
    const loggerSpy = jest.spyOn(
      (service as unknown as { logger: Logger }).logger,
      'error',
    );

    await expect(
      service.send(device, {
        deviceId: device.id,
        action: 'turn_on',
        target: 'riego',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(loggerSpy).not.toHaveBeenCalled();
  });
});

describe('resolveDeviceHttpTimeoutMs', () => {
  afterEach(() => {
    delete process.env.ESP32_HTTP_TIMEOUT_MS;
  });

  it('defaults when unset or blank', () => {
    expect(resolveDeviceHttpTimeoutMs()).toBe(DEFAULT_DEVICE_HTTP_TIMEOUT_MS);
    process.env.ESP32_HTTP_TIMEOUT_MS = '  ';
    expect(resolveDeviceHttpTimeoutMs()).toBe(DEFAULT_DEVICE_HTTP_TIMEOUT_MS);
  });

  it('honors a positive override', () => {
    process.env.ESP32_HTTP_TIMEOUT_MS = '1500';
    expect(resolveDeviceHttpTimeoutMs()).toBe(1500);
  });

  it('falls back on invalid, zero or negative values', () => {
    process.env.ESP32_HTTP_TIMEOUT_MS = 'soon';
    expect(resolveDeviceHttpTimeoutMs()).toBe(DEFAULT_DEVICE_HTTP_TIMEOUT_MS);
    process.env.ESP32_HTTP_TIMEOUT_MS = '0';
    expect(resolveDeviceHttpTimeoutMs()).toBe(DEFAULT_DEVICE_HTTP_TIMEOUT_MS);
    process.env.ESP32_HTTP_TIMEOUT_MS = '-10';
    expect(resolveDeviceHttpTimeoutMs()).toBe(DEFAULT_DEVICE_HTTP_TIMEOUT_MS);
  });
});

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  DEVICE_DRIVER,
  DRIVER_REGISTRY,
} from '../../devices/constants/driver.tokens';
import { DeviceDriver } from '../../devices/drivers/device-driver.interface';
import { DriverResolverService } from '../../devices/drivers/driver-resolver.service';
import { Esp32Driver } from '../../devices/drivers/esp32.driver';
import { Device } from '../../devices/interfaces/device.interface';
import { HttpTransportService } from './http-transport.service';
import { InMemoryTransportService } from './in-memory-transport.service';
import { MqttTransportService } from './mqtt-transport.service';
import { TransportDispatcherService } from './transport-dispatcher.service';

const mqttDriver: DeviceDriver = {
  name: 'mqtt-relay',
  transport: 'mqtt',
  supports: () => true,
  resolveEndpoint: () => '/relay',
};

function buildDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Relay MQTT',
    description: 'MQTT relay',
    driver: 'mqtt-relay',
    capabilities: ['riego'],
    mqttTopic: 'home/relays/1/set',
    ipAddress: undefined,
    port: undefined,
    status: 'online',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('TransportDispatcherService', () => {
  let dispatcher: TransportDispatcherService;
  let httpTransport: jest.Mocked<HttpTransportService>;
  let mqttTransport: MqttTransportService;
  let inMemoryTransport: jest.Mocked<InMemoryTransportService>;
  let previousDataSource: string | undefined;
  let previousMqttEnabled: string | undefined;

  beforeEach(async () => {
    previousDataSource = process.env.DATA_SOURCE;
    previousMqttEnabled = process.env.MQTT_ENABLED;
    delete process.env.DATA_SOURCE;
    delete process.env.MQTT_ENABLED;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransportDispatcherService,
        {
          provide: DRIVER_REGISTRY,
          useValue: new Map<string, DeviceDriver>([
            ['esp32', new Esp32Driver()],
            [mqttDriver.name, mqttDriver],
          ]),
        },
        {
          provide: DEVICE_DRIVER,
          useExisting: DriverResolverService,
        },
        DriverResolverService,
        {
          provide: HttpTransportService,
          useValue: { send: jest.fn() },
        },
        MqttTransportService,
        {
          provide: InMemoryTransportService,
          useValue: { send: jest.fn() },
        },
      ],
    }).compile();

    dispatcher = module.get<TransportDispatcherService>(
      TransportDispatcherService,
    );
    httpTransport = module.get(HttpTransportService);
    mqttTransport = module.get(MqttTransportService);
    inMemoryTransport = module.get(InMemoryTransportService);
  });

  afterEach(() => {
    if (previousDataSource === undefined) {
      delete process.env.DATA_SOURCE;
    } else {
      process.env.DATA_SOURCE = previousDataSource;
    }

    if (previousMqttEnabled === undefined) {
      delete process.env.MQTT_ENABLED;
    } else {
      process.env.MQTT_ENABLED = previousMqttEnabled;
    }
  });

  it('routes http drivers to the in-memory transport outside prisma mode', async () => {
    const device = buildDevice({ driver: 'esp32', mqttTopic: undefined });

    inMemoryTransport.send.mockResolvedValue({
      endpoint: '/riego/on',
      httpStatusCode: 200,
    });

    const result = await dispatcher.send(device, {
      deviceId: device.id,
      action: 'turn_on',
      target: 'riego',
    });

    expect(result).toEqual({ endpoint: '/riego/on', httpStatusCode: 200 });
    expect(inMemoryTransport.send.mock.calls).toHaveLength(1);
    expect(httpTransport.send.mock.calls).toHaveLength(0);
  });

  it('routes http drivers to the HTTP transport in prisma mode', async () => {
    process.env.DATA_SOURCE = 'prisma';
    const device = buildDevice({ driver: 'esp32', mqttTopic: undefined });

    httpTransport.send.mockResolvedValue({
      endpoint: '/riego/on',
      httpStatusCode: 200,
    });

    const result = await dispatcher.send(device, {
      deviceId: device.id,
      action: 'turn_on',
      target: 'riego',
    });

    expect(result).toEqual({ endpoint: '/riego/on', httpStatusCode: 200 });
    expect(httpTransport.send.mock.calls).toHaveLength(1);
    expect(inMemoryTransport.send.mock.calls).toHaveLength(0);
  });

  it('publishes once through the MQTT stub without subscribing', async () => {
    process.env.MQTT_ENABLED = 'true';
    const device = buildDevice();
    const publishSpy = jest.spyOn(mqttTransport, 'publish');

    const result = await dispatcher.send(device, {
      deviceId: device.id,
      action: 'turn_on',
      target: 'riego',
    });

    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(publishSpy).toHaveBeenCalledWith(
      'home/relays/1/set',
      JSON.stringify({ action: 'turn_on', target: 'riego' }),
    );
    expect(result).toEqual({
      endpoint: 'home/relays/1/set',
      httpStatusCode: 202,
    });
    expect('subscribe' in mqttTransport).toBe(false);
    expect(httpTransport.send.mock.calls).toHaveLength(0);
    expect(inMemoryTransport.send.mock.calls).toHaveLength(0);
  });

  it('rejects mqtt drivers with 400 while MQTT is disabled', async () => {
    const device = buildDevice();

    await expect(
      dispatcher.send(device, {
        deviceId: device.id,
        action: 'turn_on',
        target: 'riego',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(httpTransport.send.mock.calls).toHaveLength(0);
    expect(inMemoryTransport.send.mock.calls).toHaveLength(0);
  });

  it('rejects mqtt devices without a topic', async () => {
    process.env.MQTT_ENABLED = 'true';
    const device = buildDevice({ mqttTopic: undefined });

    await expect(
      dispatcher.send(device, {
        deviceId: device.id,
        action: 'turn_on',
        target: 'riego',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails closed with 400 for unknown drivers without transport contact', async () => {
    const device = buildDevice({ driver: 'plc-s7' });
    const publishSpy = jest.spyOn(mqttTransport, 'publish');

    await expect(
      dispatcher.send(device, {
        deviceId: device.id,
        action: 'turn_on',
        target: 'riego',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(httpTransport.send.mock.calls).toHaveLength(0);
    expect(publishSpy).not.toHaveBeenCalled();
    expect(inMemoryTransport.send.mock.calls).toHaveLength(0);
  });
});

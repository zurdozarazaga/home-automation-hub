import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIVER_REGISTRY } from '../constants/driver.tokens';
import { DeviceDriver } from './device-driver.interface';
import { DriverResolverService } from './driver-resolver.service';
import { Esp32Driver } from './esp32.driver';

describe('DriverResolverService', () => {
  let resolver: DriverResolverService;
  let registry: Map<string, DeviceDriver>;

  beforeEach(async () => {
    const esp32 = new Esp32Driver();
    registry = new Map([[esp32.name, esp32]]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverResolverService,
        { provide: DRIVER_REGISTRY, useValue: registry },
      ],
    }).compile();

    resolver = module.get<DriverResolverService>(DriverResolverService);
  });

  it('resolves a registered driver', () => {
    expect(resolver.resolve('esp32')).toBeInstanceOf(Esp32Driver);
  });

  it('fails closed with 400 for unknown drivers without device contact', () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    try {
      expect(() => resolver.resolve('plc-s7')).toThrow(BadRequestException);
    } finally {
      fetchSpy.mockRestore();
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resolves newly registered drivers without service changes', () => {
    const custom: DeviceDriver = {
      name: 'custom',
      transport: 'http',
      supports: () => true,
      resolveEndpoint: () => '/custom',
    };
    registry.set(custom.name, custom);

    expect(resolver.resolve('custom')).toBe(custom);
  });
});

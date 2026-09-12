import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { DRIVER_REGISTRY } from '../constants/driver.tokens';
import { DeviceDriver } from './device-driver.interface';

/**
 * Resolves a device driver name to its registered driver.
 *
 * Fail-closed: unknown drivers are rejected with 400 and the physical
 * device is never contacted.
 */
@Injectable()
export class DriverResolverService {
  private readonly logger = new Logger(DriverResolverService.name);

  constructor(
    @Inject(DRIVER_REGISTRY)
    private readonly registry: Map<string, DeviceDriver>,
  ) {}

  resolve(driverName: string): DeviceDriver {
    const driver = this.registry.get(driverName);

    if (!driver) {
      this.logger.warn(
        `Rejected action for unknown driver '${driverName}' at ${new Date().toISOString()}: no device contacted`,
      );
      throw new BadRequestException(
        `Unknown device driver '${driverName}'`,
      );
    }

    return driver;
  }
}

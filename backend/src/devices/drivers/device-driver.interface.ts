import { DeviceAction } from '../../actions/interfaces/action.interface';

/**
 * Contract every device family must implement to attach to the hub.
 *
 * The driver owns its endpoint table: services resolve an endpoint
 * through the driver and never hardcode device-family paths.
 */
export interface DeviceDriver {
  /** Registry key, e.g. 'esp32'. Matches `Device.driver`. */
  readonly name: string;

  /** Transport this driver speaks ('http' today; 'mqtt' is a future stub). */
  readonly transport: 'http' | 'mqtt';

  /** Whether this driver knows how to address the given target. */
  supports(target: string): boolean;

  /** Resolve the device-side endpoint for an action/target pair. */
  resolveEndpoint(action: DeviceAction, target: string): string;
}

import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ActionsService } from '../actions/actions.service';
import {
  COMMAND_ACK_TIMEOUT_MS,
  DEVICE_OFFLINE_THRESHOLD_MS,
  isPushLinkMode,
} from '../common/device-link';
import { DevicesService } from '../devices/devices.service';
import {
  ACK_TIMEOUT_ERROR_MESSAGE,
  DEFAULT_BOARD_SWEEP_INTERVAL_MS,
} from './board.constants';
import { DEVICE_COMMAND_REPOSITORY } from './constants/device-command-repository.token';
import type { DeviceCommandRepository } from './interfaces/device-command-repository.interface';

/**
 * Interval in ms. `<= 0` disables the sweep; unset or invalid values fall
 * back to the 30s default.
 */
export function resolveBoardSweepIntervalMs(): number {
  const raw = process.env.BOARD_SWEEP_INTERVAL_MS;

  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_BOARD_SWEEP_INTERVAL_MS;
  }

  const intervalMs = Number(raw);

  if (!Number.isFinite(intervalMs)) {
    return DEFAULT_BOARD_SWEEP_INTERVAL_MS;
  }

  return intervalMs > 0 ? intervalMs : 0;
}

/**
 * Push-link staleness sweep.
 *
 * Commands stuck in pending/dispatched past the ack timeout are expired and
 * logged as failed ("ack timeout") through the shared recordOutcome path.
 * Devices whose last sync is older than the offline threshold flip to
 * offline, mirroring what the pull poller used to detect.
 *
 * Runs only in push mode (the pull poller owns staleness otherwise) and in
 * prisma mode (an in-memory fake has no real staleness).
 */
@Injectable()
export class BoardSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BoardSweepService.name);
  private timer?: ReturnType<typeof setInterval>;
  private sweepRunning = false;

  constructor(
    private readonly devicesService: DevicesService,
    @Inject(DEVICE_COMMAND_REPOSITORY)
    private readonly commandRepository: DeviceCommandRepository,
    private readonly actionsService: ActionsService,
  ) {}

  onModuleInit(): void {
    if (!isPushLinkMode()) {
      this.logger.log('Board sweep disabled (DEVICE_LINK_MODE is not push)');
      return;
    }

    if (process.env.DATA_SOURCE !== 'prisma') {
      this.logger.log('Board sweep disabled (DATA_SOURCE is not prisma)');
      return;
    }

    const intervalMs = resolveBoardSweepIntervalMs();

    if (intervalMs === 0) {
      this.logger.log('Board sweep disabled (BOARD_SWEEP_INTERVAL_MS <= 0)');
      return;
    }

    this.timer = setInterval(() => void this.sweepOnce(), intervalMs);
    this.logger.log(`Board sweep started (every ${intervalMs}ms)`);

    // First run right away so a restart heals stale state immediately.
    void this.sweepOnce();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async sweepOnce(): Promise<void> {
    if (this.sweepRunning) {
      return;
    }

    this.sweepRunning = true;

    try {
      await this.expireStaleCommands();
      await this.markStaleDevicesOffline();
    } catch (error) {
      this.logger.error(
        'Board sweep cycle failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.sweepRunning = false;
    }
  }

  private async expireStaleCommands(): Promise<void> {
    const cutoff = new Date(Date.now() - COMMAND_ACK_TIMEOUT_MS);
    const expired = await this.commandRepository.expireStale(
      cutoff,
      ACK_TIMEOUT_ERROR_MESSAGE,
    );

    for (const command of expired) {
      await this.actionsService.recordOutcome(
        {
          deviceId: command.deviceId,
          action: command.action,
          target: command.target,
        },
        { endpoint: command.endpoint ?? 'unknown', httpStatusCode: 502 },
        'failed',
        ACK_TIMEOUT_ERROR_MESSAGE,
      );

      this.logger.warn(
        `Device command ${command.id} expired without ack (${ACK_TIMEOUT_ERROR_MESSAGE})`,
      );
    }
  }

  private async markStaleDevicesOffline(): Promise<void> {
    const now = Date.now();
    const devices = await this.devicesService.findAll();

    for (const device of devices) {
      const isStale =
        device.status === 'online' &&
        (device.lastSeenAt === null ||
          now - device.lastSeenAt.getTime() > DEVICE_OFFLINE_THRESHOLD_MS);

      if (!isStale) {
        continue;
      }

      await this.devicesService.updateStatus(device.id, 'offline');
      this.logger.log(
        `Device ${device.name} (${device.id}) status online -> offline (stale sync)`,
      );
    }
  }
}

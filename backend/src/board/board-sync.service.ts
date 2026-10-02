import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActionsService } from '../actions/actions.service';
import { DevicesService } from '../devices/devices.service';
import type { Device } from '../devices/interfaces/device.interface';
import { buildDht22Readings } from '../telemetry/dht22-readings';
import { TelemetryService } from '../telemetry/telemetry.service';
import { MAX_PENDING_COMMANDS_PER_SYNC } from './board.constants';
import { DEVICE_COMMAND_REPOSITORY } from './constants/device-command-repository.token';
import type {
  BoardAckDto,
  BoardSensorsDto,
  BoardSyncDto,
} from './dto/board-sync.dto';
import type { BoardSyncResponse } from './interfaces/board-sync.interface';
import type { DeviceCommandRepository } from './interfaces/device-command-repository.interface';

/**
 * Board -> hub heartbeat for the push link (VPS-friendly).
 *
 * Each sync refreshes Device.lastSeenAt, applies the acks of previously
 * dispatched commands (writing their final ActionLog row), ingests a valid
 * DHT22 snapshot and returns the pending commands, now dispatched.
 */
@Injectable()
export class BoardSyncService {
  private readonly logger = new Logger(BoardSyncService.name);

  constructor(
    private readonly devicesService: DevicesService,
    @Inject(DEVICE_COMMAND_REPOSITORY)
    private readonly commandRepository: DeviceCommandRepository,
    private readonly telemetryService: TelemetryService,
    private readonly actionsService: ActionsService,
  ) {}

  async sync(dto: BoardSyncDto): Promise<BoardSyncResponse> {
    const device = await this.findDeviceByMac(dto.mac);

    await this.devicesService.markSeen(device.id);
    await this.processAcks(device.id, dto.acks ?? []);

    if (dto.sensors?.valid === true) {
      await this.ingestSensors(device.id, dto.sensors);
    }

    const commands = await this.commandRepository.claimPendingByDevice(
      device.id,
      new Date(),
      MAX_PENDING_COMMANDS_PER_SYNC,
    );

    return {
      deviceId: device.id,
      commands: commands.map((command) => ({
        id: command.id,
        action: command.action,
        target: command.target,
      })),
    };
  }

  private async findDeviceByMac(mac: string): Promise<Device> {
    const device = await this.devicesService.findByMacAddress(mac);

    if (!device) {
      throw new NotFoundException(
        `No device registered with MAC ${mac}. Register it with: npm run devices:register -- --name <name> --ip <ip> --port <port> --mac ${mac}`,
      );
    }

    return device;
  }

  private async processAcks(
    deviceId: string,
    acks: BoardAckDto[],
  ): Promise<void> {
    for (const ack of acks) {
      const command = await this.commandRepository.findById(ack.id);

      if (!command || command.deviceId !== deviceId) {
        this.logger.warn(
          `Ignoring ack for unknown command ${ack.id} from device ${deviceId}`,
        );
        continue;
      }

      // Duplicate acks are expected (the board may re-send after a network
      // drop); only a pending/dispatched command can be acknowledged once.
      if (command.status !== 'pending' && command.status !== 'dispatched') {
        continue;
      }

      const result = ack.ok ? 'success' : 'failed';
      const errorMessage = ack.ok
        ? undefined
        : `Board reported ack failure (httpStatus: ${ack.httpStatus ?? 'unknown'})`;

      const acknowledged = await this.commandRepository.acknowledge(ack.id, {
        result,
        errorMessage,
        ackedAt: new Date(),
      });

      if (!acknowledged) {
        continue;
      }

      // Final outcome of a queued command: the only ActionLog write for the
      // push path (the enqueue deliberately does not log).
      await this.actionsService.recordOutcome(
        {
          deviceId,
          action: acknowledged.action,
          target: acknowledged.target,
        },
        {
          endpoint: acknowledged.endpoint ?? 'unknown',
          httpStatusCode: ack.httpStatus ?? (ack.ok ? 200 : 502),
        },
        result,
        errorMessage,
      );
    }
  }

  private async ingestSensors(
    deviceId: string,
    sensors: BoardSensorsDto,
  ): Promise<void> {
    const readings = buildDht22Readings(sensors, new Date().toISOString());

    if (readings.length === 0) {
      return;
    }

    try {
      await this.telemetryService.ingest(deviceId, { readings });
    } catch (error) {
      // Telemetry is best-effort: a bad sensor snapshot must never fail sync.
      this.logger.warn(
        `Failed to ingest telemetry from device ${deviceId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}

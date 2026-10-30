import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  AcknowledgeDeviceCommandInput,
  CreateDeviceCommandInput,
  DeviceCommandRepository,
} from '../interfaces/device-command-repository.interface';
import type { DeviceCommand } from '../interfaces/device-command.interface';

@Injectable()
export class InMemoryDeviceCommandRepository implements DeviceCommandRepository {
  private readonly commands = new Map<string, DeviceCommand>();

  create(input: CreateDeviceCommandInput): Promise<DeviceCommand> {
    const command: DeviceCommand = {
      id: randomUUID(),
      deviceId: input.deviceId,
      action: input.action,
      target: input.target,
      endpoint: input.endpoint,
      status: 'pending',
      createdAt: input.createdAt ?? new Date(),
    };

    this.commands.set(command.id, command);
    return Promise.resolve(command);
  }

  findById(id: string): Promise<DeviceCommand | null> {
    return Promise.resolve(this.commands.get(id) ?? null);
  }

  claimPendingByDevice(
    deviceId: string,
    dispatchedAt: Date,
    limit: number,
  ): Promise<DeviceCommand[]> {
    const claimed = Array.from(this.commands.values())
      .filter(
        (command) =>
          command.deviceId === deviceId && command.status === 'pending',
      )
      .sort(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
      )
      .slice(0, limit)
      .map((command) => {
        const dispatched: DeviceCommand = {
          ...command,
          status: 'dispatched',
          dispatchedAt,
        };
        this.commands.set(dispatched.id, dispatched);
        return dispatched;
      });

    return Promise.resolve(claimed);
  }

  acknowledge(
    id: string,
    input: AcknowledgeDeviceCommandInput,
  ): Promise<DeviceCommand | null> {
    const command = this.commands.get(id);

    if (
      !command ||
      (command.status !== 'pending' && command.status !== 'dispatched')
    ) {
      return Promise.resolve(null);
    }

    const acked: DeviceCommand = {
      ...command,
      status: 'acked',
      result: input.result,
      errorMessage: input.errorMessage,
      ackedAt: input.ackedAt,
    };

    this.commands.set(id, acked);
    return Promise.resolve(acked);
  }

  expireStale(cutoff: Date, errorMessage: string): Promise<DeviceCommand[]> {
    const expired: DeviceCommand[] = [];

    for (const command of this.commands.values()) {
      const isExpirable =
        command.status === 'pending' || command.status === 'dispatched';

      if (!isExpirable) {
        continue;
      }

      const dispatchReference = command.dispatchedAt ?? command.createdAt;

      if (dispatchReference >= cutoff) {
        continue;
      }

      const updated: DeviceCommand = {
        ...command,
        status: 'expired',
        result: 'failed',
        errorMessage,
      };

      this.commands.set(command.id, updated);
      expired.push(updated);
    }

    return Promise.resolve(expired);
  }
}

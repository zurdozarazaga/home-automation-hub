import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TelemetryRepository } from '../interfaces/telemetry-repository.interface';
import {
  TelemetryIngestInput,
  TelemetryRangeQuery,
  TelemetryReading,
} from '../interfaces/telemetry-reading.interface';

@Injectable()
export class InMemoryTelemetryRepository implements TelemetryRepository {
  private readonly readings = new Map<string, TelemetryReading>();

  ingestMany(inputs: TelemetryIngestInput[]): Promise<number> {
    for (const input of inputs) {
      const reading: TelemetryReading = {
        id: randomUUID(),
        deviceId: input.deviceId,
        ts: input.ts,
        metric: input.metric,
        value: input.value,
        unit: input.unit,
        source: input.source,
      };

      this.readings.set(reading.id, reading);
    }

    return Promise.resolve(inputs.length);
  }

  query(deviceId: string, range: TelemetryRangeQuery): Promise<TelemetryReading[]> {
    const matches = Array.from(this.readings.values())
      .filter(
        (reading) =>
          reading.deviceId === deviceId &&
          (range.metric === undefined || reading.metric === range.metric) &&
          reading.ts >= range.from &&
          reading.ts <= range.to,
      )
      .sort((left, right) => left.ts.getTime() - right.ts.getTime())
      .slice(0, range.limit);

    return Promise.resolve(matches);
  }

  deleteByDeviceId(deviceId: string): Promise<number> {
    let deleted = 0;

    for (const [id, reading] of this.readings) {
      if (reading.deviceId === deviceId) {
        this.readings.delete(id);
        deleted += 1;
      }
    }

    return Promise.resolve(deleted);
  }
}

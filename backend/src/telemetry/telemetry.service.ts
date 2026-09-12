import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DevicesService } from '../devices/devices.service';
import { TELEMETRY_REPOSITORY } from './constants/telemetry-repository.token';
import { IngestTelemetryDto } from './dto/ingest-telemetry.dto';
import { QueryTelemetryDto } from './dto/query-telemetry.dto';
import type { TelemetryRepository } from './interfaces/telemetry-repository.interface';
import type {
  TelemetryIngestResult,
  TelemetryReading,
} from './interfaces/telemetry-reading.interface';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 1000;
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class TelemetryService {
  constructor(
    private readonly devicesService: DevicesService,
    @Inject(TELEMETRY_REPOSITORY)
    private readonly telemetryRepository: TelemetryRepository,
  ) {}

  async ingest(
    deviceId: string,
    dto: IngestTelemetryDto,
  ): Promise<TelemetryIngestResult> {
    await this.devicesService.findById(deviceId);

    const count = await this.telemetryRepository.ingestMany(
      dto.readings.map((reading) => ({
        deviceId,
        ts: new Date(reading.ts),
        metric: reading.metric,
        value: reading.value,
        unit: reading.unit,
        source: reading.source,
      })),
    );

    return { deviceId, count };
  }

  async query(
    deviceId: string,
    dto: QueryTelemetryDto,
  ): Promise<TelemetryReading[]> {
    await this.devicesService.findById(deviceId);

    const range = this.resolveBounds(dto);

    return this.telemetryRepository.query(deviceId, {
      metric: dto.metric,
      ...range,
    });
  }

  private resolveBounds(dto: QueryTelemetryDto): {
    from: Date;
    to: Date;
    limit: number;
  } {
    const limit = dto.limit ?? DEFAULT_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new BadRequestException(
        `Query limit must be an integer between 1 and ${MAX_LIMIT}`,
      );
    }

    const to = dto.to ? new Date(dto.to) : new Date();
    const from = dto.from
      ? new Date(dto.from)
      : new Date(to.getTime() - DEFAULT_WINDOW_MS);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Query range dates must be valid');
    }

    if (from > to) {
      throw new BadRequestException(
        'Query range start must be before range end',
      );
    }

    if (to.getTime() - from.getTime() > MAX_WINDOW_MS) {
      throw new BadRequestException('Query range must not exceed 7 days');
    }

    return { from, to, limit };
  }
}

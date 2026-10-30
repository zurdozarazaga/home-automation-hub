import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TelemetryRepository } from '../interfaces/telemetry-repository.interface';
import {
  TelemetryIngestInput,
  TelemetryRangeQuery,
  TelemetryReading,
} from '../interfaces/telemetry-reading.interface';

@Injectable()
export class PrismaTelemetryRepository implements TelemetryRepository {
  private readonly logger = new Logger(PrismaTelemetryRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingestMany(inputs: TelemetryIngestInput[]): Promise<number> {
    try {
      const result = await this.prisma.telemetryReading.createMany({
        data: inputs.map((input) => ({
          deviceId: input.deviceId,
          ts: input.ts,
          metric: input.metric,
          value: input.value,
          unit: input.unit,
          source: input.source,
        })),
      });

      return result.count;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Telemetry readings already exist');
      }

      if (this.isRecordNotFoundError(error)) {
        throw new NotFoundException('Device not found for telemetry ingest');
      }

      if (this.isForeignKeyError(error)) {
        throw new BadRequestException(
          'Telemetry ingest references an unknown device',
        );
      }

      this.logger.error(
        `Failed to ingest ${inputs.length} telemetry readings`,
        error,
      );
      throw new InternalServerErrorException('Failed to ingest telemetry');
    }
  }

  async query(
    deviceId: string,
    range: TelemetryRangeQuery,
  ): Promise<TelemetryReading[]> {
    try {
      const rows = await this.prisma.telemetryReading.findMany({
        where: {
          deviceId,
          metric: range.metric,
          ts: { gte: range.from, lte: range.to },
        },
        orderBy: { ts: 'asc' },
        take: range.limit,
      });

      return rows.map((row) => this.mapReading(row));
    } catch (error) {
      this.logger.error(
        `Failed to query telemetry for device: ${deviceId}`,
        error,
      );
      throw new InternalServerErrorException('Failed to query telemetry');
    }
  }

  async deleteByDeviceId(deviceId: string): Promise<number> {
    try {
      const result = await this.prisma.telemetryReading.deleteMany({
        where: { deviceId },
      });

      return result.count;
    } catch (error) {
      this.logger.error(
        `Failed to delete telemetry for device: ${deviceId}`,
        error,
      );
      throw new InternalServerErrorException('Failed to delete telemetry');
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return this.getPrismaErrorCode(error) === 'P2002';
  }

  private isRecordNotFoundError(error: unknown): boolean {
    return this.getPrismaErrorCode(error) === 'P2025';
  }

  private isForeignKeyError(error: unknown): boolean {
    return this.getPrismaErrorCode(error) === 'P2003';
  }

  private getPrismaErrorCode(error: unknown): string | null {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return null;
    }

    const code = (error as { code?: unknown }).code;
    if (typeof code !== 'string') {
      return null;
    }

    return code;
  }

  private mapReading(row: {
    id: string;
    deviceId: string;
    ts: Date;
    metric: string;
    value: number;
    unit: string | null;
    source: string | null;
  }): TelemetryReading {
    return {
      id: row.id,
      deviceId: row.deviceId,
      ts: row.ts,
      metric: row.metric,
      value: row.value,
      unit: row.unit ?? undefined,
      source: row.source ?? undefined,
    };
  }
}

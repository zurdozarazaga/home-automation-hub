import {
  TelemetryIngestInput,
  TelemetryRangeQuery,
  TelemetryReading,
} from './telemetry-reading.interface';

export interface TelemetryRepository {
  ingestMany(readings: TelemetryIngestInput[]): Promise<number>;
  query(deviceId: string, range: TelemetryRangeQuery): Promise<TelemetryReading[]>;
  deleteByDeviceId(deviceId: string): Promise<number>;
}

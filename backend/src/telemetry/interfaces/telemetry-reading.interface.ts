export interface TelemetryReading {
  id: string;
  deviceId: string;
  ts: Date;
  metric: string;
  value: number;
  unit?: string;
  source?: string;
}

export interface TelemetryIngestInput {
  deviceId: string;
  ts: Date;
  metric: string;
  value: number;
  unit?: string;
  source?: string;
}

export interface TelemetryRangeQuery {
  metric?: string;
  from: Date;
  to: Date;
  limit: number;
}

export interface TelemetryIngestResult {
  deviceId: string;
  count: number;
}

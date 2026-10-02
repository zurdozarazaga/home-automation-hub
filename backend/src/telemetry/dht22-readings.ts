import type { TelemetryReadingDto } from './dto/ingest-telemetry.dto';

export interface Dht22Snapshot {
  temperature_c?: number | null;
  humidity_pct?: number | null;
}

/**
 * Maps a DHT22 snapshot to the shared telemetry contract:
 * temperature/celsius/dht22 and humidity/percent/dht22. Callers check the
 * `valid` flag first; non-numeric fields are skipped.
 *
 * Shared by the pull poller and the push board sync so both links produce
 * identical readings.
 */
export function buildDht22Readings(
  snapshot: Dht22Snapshot,
  ts: string,
): TelemetryReadingDto[] {
  const readings: TelemetryReadingDto[] = [];

  if (typeof snapshot.temperature_c === 'number') {
    readings.push({
      ts,
      metric: 'temperature',
      value: snapshot.temperature_c,
      unit: 'celsius',
      source: 'dht22',
    });
  }

  if (typeof snapshot.humidity_pct === 'number') {
    readings.push({
      ts,
      metric: 'humidity',
      value: snapshot.humidity_pct,
      unit: 'percent',
      source: 'dht22',
    });
  }

  return readings;
}

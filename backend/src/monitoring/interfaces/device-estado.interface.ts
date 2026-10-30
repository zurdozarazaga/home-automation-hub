/**
 * GET /estado contract exposed by the ESP32 firmware
 * (firmware/esp32/src/api/web_routes.h). The board has no clock: freshness
 * travels as age_s and the backend stamps ts on ingest.
 */
export interface DeviceEstadoSensors {
  temperature_c?: number | null;
  humidity_pct?: number | null;
  age_s?: number | null;
  valid?: boolean;
}

export interface DeviceEstadoResponse {
  status?: string;
  uptime_s?: number;
  free_heap?: number;
  rssi_dbm?: number;
  relays?: Record<string, boolean>;
  sensors?: DeviceEstadoSensors;
}

#pragma once
// api/state_json.h - Shared JSON shapes for the backend contract.
//
// GET /estado (api/web_routes.h) and the outbound sync payload
// (net/hub_sync.h) must report the same relays/sensors objects; both build
// them here so the shapes cannot drift.

#include <ArduinoJson.h>

#include "hal/relays.h"
#include "sensors/dht22.h"

namespace api::state {

inline void fillRelays(JsonObject relays) {
  relays["riego"] = hal::relays::riegoState();
  relays["luces"] = hal::relays::lucesState();
}

inline void fillSensors(JsonObject sensors) {
  // Backend telemetry contract (telemetry/dto/ingest-telemetry.dto.ts)
  // ingests metric readings {ts, metric, value, unit?, source?}. The
  // forwarder maps this snapshot as:
  //   temperature_c -> {metric: "temperature", unit: "celsius", source: "dht22"}
  //   humidity_pct  -> {metric: "humidity", unit: "percent", source: "dht22"}
  // No clock on the board: freshness travels as age_s, backend stamps ts.
  if (sensors::dht22::hasReading()) {
    sensors["temperature_c"] = sensors::dht22::temperatureC();
    sensors["humidity_pct"] = sensors::dht22::humidityPct();
    sensors["age_s"] = sensors::dht22::readingAgeMs() / 1000;
  } else {
    sensors["temperature_c"] = nullptr;
    sensors["humidity_pct"] = nullptr;
    sensors["age_s"] = nullptr;
  }
  sensors["valid"] = sensors::dht22::hasReading();
}

}  // namespace api::state

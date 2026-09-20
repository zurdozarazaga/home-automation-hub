#pragma once
// api/web_routes.h - HTTP contract consumed by the NestJS backend.
//
// Contract (see spec.md): POST /riego/on|off, POST /luces/on|off,
// GET /estado, GET /health. The backend maps
// POST /devices/:deviceId/actions {action, target} onto these endpoints;
// a silent board surfaces there as HTTP 502, so handlers stay small and
// never block. Relay POSTs drive real GPIO through hal::relays and answer
// with the resulting hardware state.
//
// Sync WebServer from the Arduino core on purpose: ElegantOTA only exposes
// begin(WebServer*), so an async server does not fit. Revisit only if the
// sync server ever becomes a bottleneck.

#include <Arduino.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <WiFi.h>

#include "hal/relays.h"
#include "sensors/dht22.h"
#include "sys/build_info.h"
#include "sys/watchdog.h"

namespace api::routes {

inline void sendJson(WebServer& server, const JsonDocument& doc) {
  String body;
  serializeJson(doc, body);
  server.send(200, "application/json", body);
}

inline void registerRoutes(WebServer& server) {
  server.on("/health", HTTP_GET, [&server]() {
    JsonDocument doc;
    doc["status"] = "ok";
    // fw + reset_reason make an OTA update and a watchdog reset verifiable
    // over HTTP ("fw" changes after an update; "TASK_WDT" after /debug/hang).
    doc["fw"] = sys::build_info::version();
    doc["reset_reason"] = sys::watchdog::resetReasonName();
    doc["ota_enabled"] = sys::build_info::otaEnabled();
    doc["uptime_s"] = millis() / 1000;
    doc["free_heap"] = ESP.getFreeHeap();
    sendJson(server, doc);
  });

  server.on("/estado", HTTP_GET, [&server]() {
    JsonDocument doc;
    doc["status"] = "ok";
    doc["uptime_s"] = millis() / 1000;
    doc["free_heap"] = ESP.getFreeHeap();
    doc["rssi_dbm"] = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
    JsonObject relays = doc["relays"].to<JsonObject>();
    relays["riego"] = hal::relays::riegoState();
    relays["luces"] = hal::relays::lucesState();
    JsonObject sensors = doc["sensors"].to<JsonObject>();
    // Backend telemetry contract (telemetry/dto/ingest-telemetry.dto.ts)
    // ingests metric readings {ts, metric, value, unit?, source?}. The
    // future forwarder maps this snapshot as:
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
    sendJson(server, doc);
  });

  auto relayStub = [&server](const char* target, bool on) {
    return [&server, target, on]() {
      const hal::relays::Relay relay = (strcmp(target, "riego") == 0)
                                           ? hal::relays::Relay::Riego
                                           : hal::relays::Relay::Luces;
      hal::relays::setRelay(relay, on);
      JsonDocument doc;
      doc["ok"] = true;
      doc["target"] = target;
      doc["action"] = on ? "turn_on" : "turn_off";
      doc["state"] = hal::relays::isRelayOn(relay) ? "on" : "off";
      doc["applied"] = true;
      sendJson(server, doc);
    };
  };

  server.on("/riego/on", HTTP_POST, relayStub("riego", true));
  server.on("/riego/off", HTTP_POST, relayStub("riego", false));
  server.on("/luces/on", HTTP_POST, relayStub("luces", true));
  server.on("/luces/off", HTTP_POST, relayStub("luces", false));

#ifdef DEBUG_HANG
  // DEBUG_HANG builds only: block the loop on demand to verify on hardware
  // that the task watchdog panics and resets the board (see firmware/README.md).
  server.on("/debug/hang", HTTP_POST, [&server]() {
    JsonDocument doc;
    doc["ok"] = true;
    doc["note"] = "loop blocked on purpose, task watchdog should reset the board";
    sendJson(server, doc);
    Serial.println("[hub][debug] hang requested, expecting a watchdog reset");
    sys::watchdog::hangForever();
  });
#endif

  server.onNotFound([&server]() {
    JsonDocument doc;
    doc["ok"] = false;
    doc["error"] = "not_found";
    String body;
    serializeJson(doc, body);
    server.send(404, "application/json", body);
  });
}

}  // namespace api::routes

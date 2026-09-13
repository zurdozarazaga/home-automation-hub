#pragma once
// api/web_routes.h - HTTP contract consumed by the NestJS backend.
//
// Contract (see spec.md): POST /riego/on|off, POST /luces/on|off,
// GET /estado, GET /health. The backend maps
// POST /devices/:deviceId/actions {action, target} onto these endpoints;
// a silent board surfaces there as HTTP 502, so handlers stay small and
// never block. Relay POSTs are stubs in this slice: they log only, the
// real GPIO lands in the relay slice.
//
// Sync WebServer from the Arduino core on purpose: ElegantOTA only exposes
// begin(WebServer*), so an async server does not fit. Revisit only if the
// sync server ever becomes a bottleneck.

#include <Arduino.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <WiFi.h>

#include "hal/relays.h"

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
    sendJson(server, doc);
  });

  auto relayStub = [&server](const char* target, bool on) {
    return [&server, target, on]() {
      if (strcmp(target, "riego") == 0) {
        hal::relays::setRiego(on);
      } else {
        hal::relays::setLuces(on);
      }
      JsonDocument doc;
      doc["ok"] = true;
      doc["target"] = target;
      doc["action"] = on ? "turn_on" : "turn_off";
      doc["applied"] = false;
      doc["note"] = "stub: GPIO lands in the relay slice";
      sendJson(server, doc);
    };
  };

  server.on("/riego/on", HTTP_POST, relayStub("riego", true));
  server.on("/riego/off", HTTP_POST, relayStub("riego", false));
  server.on("/luces/on", HTTP_POST, relayStub("luces", true));
  server.on("/luces/off", HTTP_POST, relayStub("luces", false));

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

// main.cpp - Home Automation Hub firmware, slice 1 (scaffold).
//
// Boots an ESP32-S3 DevKitC-1 with: Serial hello, fail-safe relay state,
// WiFi from NVS credentials, GET /health, GET /estado, and stub
// POST /riego + /luces (log only, no GPIO yet).
//
// Layering (header-only on purpose, kept migration-friendly to ESP-IDF):
//   hal/ -> physical outputs (safe state first)
//   net/  -> WiFi + NVS credentials + reconnect
//   api/  -> HTTP contract consumed by the NestJS backend

#include <Arduino.h>
#include <ElegantOTA.h>
#include <ESPAsyncWebServer.h>

#include "api/web_routes.h"
#include "hal/relays.h"
#include "net/wifi_nvs.h"

namespace {
constexpr unsigned long kSerialBaud = 115200;
constexpr uint16_t kHttpPort = 80;
}  // namespace

AsyncWebServer server(kHttpPort);

void setup() {
  Serial.begin(kSerialBaud);
  // Native USB on the S3 needs a moment; never block forever without USB.
  const unsigned long start = millis();
  while (!Serial && millis() - start < 2000) {
  }
  Serial.println("\n[hub] hello from ESP32-S3 (firmware scaffold)");

  // Fail-safe first: relays to safe state before anything else runs.
  hal::relays::applySafeState();

  if (!net::wifi::connectFromNvs()) {
    Serial.println("[hub][net] continuing without WiFi, HTTP unreachable until provisioned");
  }

  api::routes::registerRoutes(server);
  ElegantOTA.begin(&server);
  server.begin();
  Serial.printf("[hub][api] HTTP listening on port %u\n", kHttpPort);
}

void loop() {
  ElegantOTA.loop();
  net::wifi::maintain();
  delay(100);
}

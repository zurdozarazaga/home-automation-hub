// main.cpp - Home Automation Hub firmware.
//
// Boots an ESP32-S3 DevKitC-1 with: Serial hello, fail-safe relay state,
// DHT22 ambient sensing (cached reads), WiFi from NVS credentials,
// GET /health, GET /estado (relays + sensors), and POST /riego + /luces
// driving real GPIO.
//
// Layering (header-only on purpose, kept migration-friendly to ESP-IDF):
//   hal/ -> physical outputs (safe state first)
//   sensors/ -> physical inputs (cached reads, never block the server)
//   net/  -> WiFi + NVS credentials + reconnect
//   api/  -> HTTP contract consumed by the NestJS backend

#include <Arduino.h>
#include <ElegantOTA.h>
#include <WebServer.h>

#include "api/web_routes.h"
#include "hal/relays.h"
#include "net/wifi_nvs.h"
#include "sensors/dht22.h"

namespace {
constexpr unsigned long kSerialBaud = 115200;
constexpr uint16_t kHttpPort = 80;
}  // namespace

WebServer server(kHttpPort);

void setup() {
  Serial.begin(kSerialBaud);
  // Native USB on the S3 needs a moment; never block forever without USB.
  const unsigned long start = millis();
  while (!Serial && millis() - start < 2000) {
  }
  Serial.println("\n[hub] hello from ESP32-S3 (firmware scaffold)");

  // Fail-safe first: relays to safe state before anything else runs.
  hal::relays::applySafeState();

  // Sensor init is hardware-only (no network), so it runs before WiFi.
  sensors::dht22::begin();

  if (!net::wifi::connectFromNvs()) {
    Serial.println("[hub][net] continuing without WiFi, HTTP unreachable until provisioned");
  }

  api::routes::registerRoutes(server);
  ElegantOTA.begin(&server);
  server.begin();
  Serial.printf("[hub][api] HTTP listening on port %u\n", kHttpPort);
}

void loop() {
  server.handleClient();
  ElegantOTA.loop();
  net::wifi::maintain();
  sensors::dht22::update();
  delay(100);
}

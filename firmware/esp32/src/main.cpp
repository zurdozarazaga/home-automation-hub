// main.cpp - Home Automation Hub firmware.
//
// Boots an ESP32-S3 DevKitC-1 with: Serial hello, fail-safe relay state,
// task watchdog, DHT22 ambient sensing (cached reads), WiFi from NVS
// credentials, authenticated OTA (ElegantOTA), GET /health, GET /estado
// (relays + sensors), and POST /riego + /luces driving real GPIO.
//
// Layering (header-only on purpose, kept migration-friendly to ESP-IDF):
//   hal/ -> physical outputs (safe state first)
//   sensors/ -> physical inputs (cached reads, never block the server)
//   net/  -> WiFi + NVS credentials + reconnect
//   api/  -> HTTP contract consumed by the NestJS backend
//   sys/  -> watchdog, reset diagnostics, OTA image confirmation

#include <Arduino.h>
#include <ElegantOTA.h>
#include <WebServer.h>

#include "api/web_routes.h"
#include "hal/relays.h"
#include "net/wifi_nvs.h"
#include "sensors/dht22.h"
#include "sys/build_info.h"
#include "sys/ota_confirm.h"
#include "sys/watchdog.h"

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
  Serial.printf("\n[hub] hello from ESP32-S3, firmware %s\n", sys::build_info::version());

  // Fail-safe first: relays to safe state before anything else runs.
  hal::relays::applySafeState();

  // Watchdog with a boot grace window: the WiFi bring-up below may block up
  // to its own 10 s connect timeout, and setup() tightens the window at the
  // end (rationale in sys/watchdog.h).
  sys::watchdog::begin();

  // Sensor init is hardware-only (no network), so it runs before WiFi.
  sensors::dht22::begin();

  if (!net::wifi::connectFromNvs()) {
    Serial.println("[hub][net] continuing without WiFi, HTTP unreachable until provisioned");
  }

  api::routes::registerRoutes(server);

#if HUB_OTA_CREDENTIALS_PRESENT
  if (sys::build_info::otaEnabled()) {
    // The sync server blocks the loop task for the whole upload, and
    // Update.begin() erases a full partition before that: stretch the
    // watchdog for the OTA window and feed it once per uploaded chunk.
    ElegantOTA.onStart([]() { sys::watchdog::useOtaTimeout(); });
    ElegantOTA.onProgress([](size_t, size_t) { sys::watchdog::kick(); });
    ElegantOTA.onEnd([](bool success) {
      sys::watchdog::useNormalTimeout();
      Serial.printf("[hub][ota] transfer %s\n", success ? "ok, rebooting" : "failed");
    });
    ElegantOTA.begin(&server, OTA_USER, OTA_PASS);
    Serial.println("[hub][ota] enabled at /update (HTTP auth on)");
  } else {
    Serial.println("[hub][ota] credentials present but empty, OTA disabled");
  }
#else
  Serial.println("[hub][ota] disabled: define OTA_USER and OTA_PASS to enable");
#endif

  server.begin();

  // Boot phase finished: tighten the watchdog to its normal 10 s window.
  sys::watchdog::useNormalTimeout();
  Serial.printf("[hub][api] HTTP listening on port %u\n", kHttpPort);
}

void loop() {
  server.handleClient();
  if (sys::build_info::otaEnabled()) {
    ElegantOTA.loop();  // Performs the post-update reboot when enabled.
  }
  net::wifi::maintain();
  sensors::dht22::update();
  sys::ota_confirm::maintain();  // Confirms a fresh OTA image once healthy.
  sys::watchdog::kick();         // All work for this iteration is done: feed.
  delay(100);
}

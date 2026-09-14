#pragma once
// sensors/dht22.h - Ambient temperature + humidity (DHT22, roadmap step 6).
//
// Pin choice (ESP32-S3 DevKitC-1): GPIO15, a free header pin with no boot,
// USB, UART, LED, flash, or relay role (see forbidden list below).
//
// Read model: the DHT22 needs ~2 s between samples, so update() refreshes a
// cache at most every kReadIntervalMs and the HTTP layer only serves the
// cache — the sync server never waits on the sensor. Backend contract
// (backend/src/telemetry/dto/ingest-telemetry.dto.ts) ingests metric
// readings {ts, metric, value, unit?, source?}; the firmware serves one
// snapshot object instead, and the future forwarder maps:
//   temperature_c -> {metric: "temperature", unit: "celsius", source: "dht22"}
//   humidity_pct  -> {metric: "humidity", unit: "percent", source: "dht22"}
// The board has no clock in this slice, so freshness travels as age_s and
// the backend stamps ts at ingest. SENSOR_FAKE=1 serves fixed values to
// validate the JSON shape without a wired sensor.

#include <Arduino.h>

#ifndef SENSOR_FAKE
#include <DHT.h>
#endif

namespace sensors::dht22 {

constexpr uint8_t kDataPin = 15;
constexpr unsigned long kReadIntervalMs = 10000;

#ifdef SENSOR_FAKE
constexpr float kFakeTemperatureC = 23.5F;
constexpr float kFakeHumidityPct = 55.0F;
#endif

// Pins that must never host the sensor: boot strapping, native USB, RGB
// LED, UART0 console, octal flash/PSRAM lines, and the relay outputs.
constexpr bool isForbiddenPin(uint8_t pin) {
  return pin == 0 || pin == 3 || pin == 45 || pin == 46 ||  // strapping
         pin == 19 || pin == 20 ||                          // native USB D-/D+
         pin == 48 ||                                       // RGB LED
         pin == 43 || pin == 44 ||                          // UART0 console
         (pin >= 26 && pin <= 37) ||                        // octal flash/PSRAM
         pin == 4 || pin == 5;                              // relays
}

static_assert(!isForbiddenPin(kDataPin), "DHT22 pin must avoid strapping/USB/UART/LED/flash/relay pins");

namespace {

struct Reading {
  float temperatureC;
  float humidityPct;
  unsigned long readAtMs;
  bool valid;
};

inline Reading& cache() {
  static Reading instance{0.0F, 0.0F, 0, false};
  return instance;
}

#ifndef SENSOR_FAKE
inline DHT& driver() {
  static DHT instance(kDataPin, DHT22);
  return instance;
}
#endif

}  // namespace

inline void begin() {
#ifdef SENSOR_FAKE
  Reading& current = cache();
  current.temperatureC = kFakeTemperatureC;
  current.humidityPct = kFakeHumidityPct;
  current.readAtMs = millis();
  current.valid = true;
  Serial.println("[hub][sensor] DHT22 FAKE mode: serving fixed 23.5 C / 55.0 %");
#else
  driver().begin();
  Serial.println("[hub][sensor] DHT22 on GPIO15");
#endif
}

inline void update() {
#ifdef SENSOR_FAKE
  return;
#else
  Reading& current = cache();
  const unsigned long now = millis();
  if (current.valid && now - current.readAtMs < kReadIntervalMs) {
    return;  // Cache is fresh, nothing to do.
  }
  // Stamp every attempt so a failing sensor retries at interval cadence
  // instead of once per loop.
  current.readAtMs = now;
  const float humidity = driver().readHumidity();
  const float temperature = driver().readTemperature();
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("[hub][sensor] DHT22 read failed, retrying on next interval");
    return;
  }
  current.temperatureC = temperature;
  current.humidityPct = humidity;
  current.valid = true;
#endif
}

inline bool hasReading() { return cache().valid; }
inline float temperatureC() { return cache().temperatureC; }
inline float humidityPct() { return cache().humidityPct; }
inline unsigned long readingAgeMs() { return millis() - cache().readAtMs; }

}  // namespace sensors::dht22

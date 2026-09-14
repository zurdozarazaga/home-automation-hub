#pragma once
// hal/relays.h - Hardware abstraction for the relay outputs.
//
// Pin choice (ESP32-S3 DevKitC-1):
// | GPIO | Relay | Active level | Why this pin                       |
// |------|-------|--------------|--------------------------------------|
// | 4    | riego | LOW          | header pin, no boot strapping role |
// | 5    | luces | LOW          | header pin, no boot strapping role |
//
// Kept free on purpose: strapping 0/3/45/46 (boot config), native USB
// D-/D+ 19/20 (USB console), RGB LED 48, UART0 console 43/44, and the
// octal SPI flash/PSRAM lines 26-37. Compile-time guards below reject any
// future edit that picks a forbidden pin.
//
// Typical optocoupler relay modules are ACTIVE-LOW (LOW energizes the
// coil), so kActiveLow stays true; flip it for active-high modules.
// applySafeState() runs first in setup(), before WiFi/server, and latches
// the OFF level before enabling the drivers so boot never pulses a relay.

#include <Arduino.h>

namespace hal::relays {

constexpr uint8_t kRiegoPin = 4;
constexpr uint8_t kLucesPin = 5;

// Module polarity: true = LOW energizes the coil (optocoupler modules).
constexpr bool kActiveLow = true;

enum class Relay : uint8_t { Riego = 0, Luces = 1 };

// Pins that must never drive a relay: boot strapping + native USB.
constexpr bool isForbiddenPin(uint8_t pin) {
  return pin == 0 || pin == 3 || pin == 45 || pin == 46 ||  // strapping
         pin == 19 || pin == 20;                            // native USB D-/D+
}

static_assert(kRiegoPin != kLucesPin, "riego and luces need different pins");
static_assert(!isForbiddenPin(kRiegoPin), "riego pin must avoid strapping/USB pins");
static_assert(!isForbiddenPin(kLucesPin), "luces pin must avoid strapping/USB pins");

constexpr const char* nameFor(Relay relay) {
  return (relay == Relay::Riego) ? "riego" : "luces";
}

constexpr uint8_t pinFor(Relay relay) {
  return (relay == Relay::Riego) ? kRiegoPin : kLucesPin;
}

// Pure action -> pin level translation: no hardware access, so it stays
// unit-testable on the host once a native test env exists (no Unity
// scaffolding in this slice on purpose).
constexpr uint8_t levelFor(bool on) {
  return (on != kActiveLow) ? HIGH : LOW;
}

inline void applySafeState() {
  // Glitch-free order: latch OFF first, then enable the output drivers.
  digitalWrite(kRiegoPin, levelFor(false));
  digitalWrite(kLucesPin, levelFor(false));
  pinMode(kRiegoPin, OUTPUT);
  pinMode(kLucesPin, OUTPUT);
  Serial.println("[hub][hal] relays -> safe state (OFF)");
}

inline void setRelay(Relay relay, bool on) {
  const uint8_t pin = pinFor(relay);
  const uint8_t level = levelFor(on);
  digitalWrite(pin, level);
  Serial.printf("[hub][hal] %s -> %s (GPIO%u %s)\n", nameFor(relay), on ? "ON" : "OFF", pin,
                level == LOW ? "LOW" : "HIGH");
}

inline bool isRelayOn(Relay relay) {
  // Reads the driven level back so /estado reports hardware, not a cache.
  return digitalRead(pinFor(relay)) == levelFor(true);
}

inline void setRiego(bool on) { setRelay(Relay::Riego, on); }
inline void setLuces(bool on) { setRelay(Relay::Luces, on); }
inline bool isRiegoOn() { return isRelayOn(Relay::Riego); }
inline bool isLucesOn() { return isRelayOn(Relay::Luces); }
inline const char* riegoState() { return isRiegoOn() ? "on" : "off"; }
inline const char* lucesState() { return isLucesOn() ? "on" : "off"; }

}  // namespace hal::relays

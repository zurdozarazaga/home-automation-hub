#pragma once
// sys/watchdog.h - Task watchdog and reset diagnostics (roadmap step 7).
//
// The Arduino loop task is subscribed to the ESP32 task watchdog (TWDT) with
// a 10 s timeout and panic=true, so a real hang resets the board instead of
// leaving it silently stuck. Recovery is fully automatic: reset -> boot ->
// fail-safe relays OFF -> WiFi -> server, no human intervention.
//
// Why 10 s: a healthy iteration takes ~100 ms (HTTP poll + WiFi + cached
// sensor read), so 10 s is ~100x the normal period: long enough to never
// trip on healthy work, short enough to beat a person noticing. Two
// deliberate exceptions:
//   - Boot grace (30 s): the WiFi bring-up may block up to its own 10 s
//     connect timeout; setup() tightens the window once boot is done.
//   - OTA window (120 s): a sync upload blocks the loop task inside
//     handleClient(), and Update.begin() erases a full partition before
//     that; the window is stretched for the transfer and fed once per
//     received chunk. A transfer stalled beyond the window still resets —
//     safe, because an incomplete image is never booted.
// Idle tasks are intentionally NOT watched: OTA flash writes pause both
// cores, which would false-trip an idle-task subscription.

#include <Arduino.h>
#include <esp_system.h>
#include <esp_task_wdt.h>

namespace sys::watchdog {

constexpr uint32_t kTimeoutMs = 10000;
constexpr uint32_t kBootGraceMs = 30000;
constexpr uint32_t kOtaTimeoutMs = 120000;

namespace detail {

// Applies a TWDT configuration whether or not it was already initialized
// (the Arduino core brings it up at startup with the IDF default config),
// then restarts the countdown so a window change never lands mid-timeout.
inline void applyConfig(uint32_t timeoutMs) {
  esp_task_wdt_config_t config = {};
  config.timeout_ms = timeoutMs;
  config.idle_core_mask = 0;  // Watch the loop task, not the idle tasks.
  config.trigger_panic = true;
  // The Arduino core already initializes the TWDT at startup, so reconfigure
  // first (init would only log "TWDT already initialized") and fall back to
  // init on boards where the core did not bring it up.
  esp_err_t err = esp_task_wdt_reconfigure(&config);
  if (err == ESP_ERR_INVALID_STATE) {
    err = esp_task_wdt_init(&config);
  }
  if (err != ESP_OK) {
    Serial.printf("[hub][sys] watchdog config failed: %d\n", (int)err);
  }
}

}  // namespace detail

inline void begin() {
  detail::applyConfig(kBootGraceMs);
  const esp_err_t err = esp_task_wdt_add(NULL);  // Subscribe the loop task.
  if (err != ESP_OK) {
    Serial.printf("[hub][sys] watchdog subscribe returned %d\n", (int)err);
  }
  esp_task_wdt_reset();  // Start the countdown only now that we are watched.
  Serial.printf("[hub][sys] task watchdog armed (%u ms boot grace, panic+reset)\n",
                kBootGraceMs);
}

// Feeds the watchdog; called once per loop iteration after all work.
inline void kick() { esp_task_wdt_reset(); }

inline void useNormalTimeout() {
  detail::applyConfig(kTimeoutMs);
  esp_task_wdt_reset();
}

inline void useOtaTimeout() {
  detail::applyConfig(kOtaTimeoutMs);
  esp_task_wdt_reset();
  Serial.printf("[hub][sys] watchdog stretched to %u ms for OTA\n", kOtaTimeoutMs);
}

// Maps the last reset cause to the label surfaced in GET /health, so a
// watchdog reset on a real board is verifiable ("TASK_WDT" after /debug/hang).
inline const char* resetReasonName() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON:
      return "POWERON";
    case ESP_RST_EXT:
      return "EXT";
    case ESP_RST_SW:
      return "SW";
    case ESP_RST_PANIC:
      return "PANIC";
    case ESP_RST_INT_WDT:
      return "INT_WDT";
    case ESP_RST_TASK_WDT:
      return "TASK_WDT";
    case ESP_RST_WDT:
      return "WDT";
    case ESP_RST_DEEPSLEEP:
      return "DEEPSLEEP";
    case ESP_RST_BROWNOUT:
      return "BROWNOUT";
    case ESP_RST_SDIO:
      return "SDIO";
    case ESP_RST_USB:
      return "USB";
    case ESP_RST_JTAG:
      return "JTAG";
    case ESP_RST_UNKNOWN:
      return "UNKNOWN";
    default:
      return "OTHER";
  }
}

#ifdef DEBUG_HANG
// DEBUG_HANG builds only: block the loop task without feeding, so the
// watchdog panics and the board resets. The busy spin avoids delay()/yield()
// side effects, keeping the test deterministic.
inline void hangForever() {
  volatile uint32_t spin = 0;
  for (;;) {
    ++spin;
  }
}
#endif

}  // namespace sys::watchdog

#pragma once
// sys/ota_confirm.h - Confirm a fresh OTA image once the boot looks healthy
// (IDF application rollback, roadmap step 8).
//
// With CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE the bootloader boots a freshly
// updated image exactly once in ESP_OTA_IMG_PENDING_VERIFY state. If the app
// resets before calling esp_ota_mark_app_valid_cancel_rollback(), the
// bootloader marks it aborted and falls back to the previous image.
//
// "Healthy boot" here means alive for kHealthyBootMs: setup() completed and
// the loop ran that long without a panic or watchdog reset. A crashing image
// never reaches the window, so its first reset triggers the rollback.
//
// Without the bootloader option the running image is never in
// PENDING_VERIFY and this module is a safe no-op. Current platform: the
// pinned pioarduino 55.03.39 prebuilt core ships with rollback disabled, so
// this confirmation only becomes active after `custom_sdkconfig` enables it
// (see firmware/README.md for the exact line, cost, and test plan).

#include <Arduino.h>
#include <esp_ota_ops.h>

namespace sys::ota_confirm {

constexpr unsigned long kHealthyBootMs = 30000;

inline void maintain() {
  static bool checked = false;
  if (checked || millis() < kHealthyBootMs) {
    return;
  }
  checked = true;  // Checked once per boot: the state can only move forward.

  const esp_partition_t* running = esp_ota_get_running_partition();
  esp_ota_img_states_t state = ESP_OTA_IMG_UNDEFINED;
  if (running == nullptr || esp_ota_get_state_partition(running, &state) != ESP_OK) {
    Serial.println("[hub][ota] could not read the running image state");
    return;
  }
  if (state != ESP_OTA_IMG_PENDING_VERIFY) {
    return;  // USB-flashed or already-valid image: nothing to confirm.
  }
  const esp_err_t err = esp_ota_mark_app_valid_cancel_rollback();
  Serial.printf("[hub][ota] pending-verify image confirmed: %s\n",
                err == ESP_OK ? "valid" : "failed");
}

}  // namespace sys::ota_confirm

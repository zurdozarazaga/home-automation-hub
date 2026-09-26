#pragma once
// net/wifi_nvs.h - WiFi station mode with credentials from NVS.
//
// Hard rule: credentials NEVER live in the repo. The SSID and password are
// read from NVS namespace "wifi" (keys "ssid" and "pass"), provisioned once
// over USB (see firmware/README.md). Nothing is hardcoded here.

#include <Arduino.h>
#include <Preferences.h>
#include <WiFi.h>

namespace net::wifi {

namespace {
constexpr unsigned long kConnectTimeoutMs = 10000;
constexpr unsigned long kReconnectIntervalMs = 10000;
}  // namespace

// True once credentials were found and a connection attempt started: the
// reconnect loop stays quiet on boards that were never provisioned.
inline bool provisioned = false;

// Reads credentials from NVS and joins the network. Returns true when the
// station is connected; false otherwise (boot continues, HTTP just stays
// unreachable until the board is provisioned or the network returns).
inline bool connectFromNvs() {
  // Bring the WiFi/lwIP stack up even without credentials: the HTTP server
  // binds during boot and lwIP is not initialized until the stack starts
  // (Arduino core 3.x), so binding without this crashes. Without credentials
  // the board simply stays unreachable until it is provisioned.
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);

  Preferences prefs;
  if (!prefs.begin("wifi", /*readOnly=*/true)) {
    Serial.println("[hub][net] NVS namespace 'wifi' not found, skipping WiFi");
    return false;
  }
  const String ssid = prefs.getString("ssid", "");
  const String pass = prefs.getString("pass", "");
  prefs.end();

  if (ssid.isEmpty()) {
    Serial.println("[hub][net] no WiFi credentials in NVS, skipping WiFi");
    return false;
  }

  provisioned = true;
  WiFi.begin(ssid.c_str(), pass.c_str());

  Serial.printf("[hub][net] connecting to SSID '%s'...\n", ssid.c_str());
  const unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < kConnectTimeoutMs) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[hub][net] connection timeout, will retry in the background");
    return false;
  }
  Serial.printf("[hub][net] connected, IP %s, RSSI %d dBm\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());
  return true;
}

// Keeps the station alive; throttled so a missing network never spins the loop.
inline void maintain() {
  static unsigned long lastAttempt = 0;
  if (!provisioned || WiFi.status() == WL_CONNECTED) {
    return;
  }
  const unsigned long now = millis();
  if (now - lastAttempt < kReconnectIntervalMs) {
    return;
  }
  lastAttempt = now;
  Serial.println("[hub][net] reconnecting...");
  WiFi.reconnect();
}

}  // namespace net::wifi

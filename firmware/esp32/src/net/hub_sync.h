#pragma once
// net/hub_sync.h - Outbound sync (push link mode) against the hub backend.
//
// Contract: docs/board-link-modes.md. Every HUB_SYNC_INTERVAL_MS (default
// 3000, override with -DHUB_SYNC_INTERVAL_MS) and with WiFi connected, the
// board POSTs its state to {url}/board/sync with a Bearer token, receives
// queued commands for its MAC, executes them on the relays, and queues acks
// that travel in the next sync.
//
// Push is additive and optional: the local HTTP server keeps behaving
// exactly the same, and with no `url` in NVS the whole module is a no-op
// with one clear boot log. Config lives in NVS namespace "hub" (keys "url"
// and "token"), written by firmware/tools/wifi-provision; credentials never
// live in the repo.
//
// Timing: one attempt blocks the loop for at most kHttpTimeoutMs (~4 s),
// comfortably inside the 10 s watchdog window. The interval is a floor, so
// a slow backend stretches the effective cadence instead of queueing
// requests.

#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WiFi.h>

#include "api/state_json.h"
#include "hal/relays.h"
#include "sys/build_info.h"
#include "sys/watchdog.h"

#ifndef HUB_SYNC_INTERVAL_MS
#define HUB_SYNC_INTERVAL_MS 3000
#endif

namespace net::hub_sync {

namespace {

constexpr unsigned long kIntervalMs = HUB_SYNC_INTERVAL_MS;
constexpr uint16_t kHttpTimeoutMs = 4000;
constexpr size_t kAckCapacity = 8;

struct Config {
  String url;    // e.g. "http://hub.example.com:3001" (trailing '/' tolerated)
  String token;  // JWT with role service; never logged
  bool enabled;
};

struct Ack {
  String id;
  bool ok;
  int httpStatus;
  String error;  // Empty unless ok == false.
};

struct AckQueue {
  Ack items[kAckCapacity];
  size_t count;
};

inline AckQueue& ackQueue() {
  static AckQueue instance{};
  return instance;
}

// Read once on first use: url/token come from NVS and never change at
// runtime (re-provision and reboot to change them).
inline Config& config() {
  static Config instance = []() {
    Config cfg;
    Preferences prefs;
    if (prefs.begin("hub", /*readOnly=*/true)) {
      cfg.url = prefs.getString("url", "");
      cfg.token = prefs.getString("token", "");
      prefs.end();
    }
    while (cfg.url.endsWith("/")) {
      cfg.url.remove(cfg.url.length() - 1);
    }
    cfg.enabled = !cfg.url.isEmpty();
    return cfg;
  }();
  return instance;
}

inline void enqueueAck(const String& id, bool ok, int httpStatus, const char* error = nullptr) {
  AckQueue& queue = ackQueue();
  if (queue.count == kAckCapacity) {
    // Small buffer by design: drop the oldest ack; the backend expires its
    // command after its own ack timeout (120 s, see docs/board-link-modes.md).
    for (size_t i = 1; i < queue.count; ++i) {
      queue.items[i - 1] = queue.items[i];
    }
    --queue.count;
  }
  Ack& slot = queue.items[queue.count++];
  slot.id = id;
  slot.ok = ok;
  slot.httpStatus = httpStatus;
  slot.error = (error == nullptr) ? "" : error;
}

// Logs only on state transitions: a 3 s cadence must not spam the console.
inline void reportStatus(int code) {
  static int lastReported = 0;  // 0 = nothing reported yet
  if (code == lastReported) {
    return;
  }
  lastReported = code;
  if (code == 200) {
    Serial.println("[hub][sync] link up");
    return;
  }
  if (code == -1) {
    Serial.println("[hub][sync] link down: connection failed");
    return;
  }
  if (code == -2) {
    Serial.println("[hub][sync] link down: invalid url in NVS");
    return;
  }
  const char* hint = "";
  switch (code) {
    case 400:
      hint = "bad request";
      break;
    case 401:
      hint = "unauthorized (check token)";
      break;
    case 403:
      hint = "forbidden (needs service role)";
      break;
    case 404:
      hint = "mac not registered";
      break;
    default:
      break;
  }
  Serial.printf("[hub][sync] link down: http %d %s\n", code, hint);
}

inline bool executeCommand(const char* action, const char* target) {
  const bool on = strcmp(action, "turn_on") == 0;
  const bool off = strcmp(action, "turn_off") == 0;
  const bool riego = strcmp(target, "riego") == 0;
  const bool luces = strcmp(target, "luces") == 0;
  if ((!on && !off) || (!riego && !luces)) {
    return false;
  }
  const hal::relays::Relay relay =
      riego ? hal::relays::Relay::Riego : hal::relays::Relay::Luces;
  hal::relays::setRelay(relay, on);
  return true;
}

inline String buildPayload() {
  JsonDocument doc;
  doc["mac"] = WiFi.macAddress();
  doc["fw"] = sys::build_info::version();
  doc["uptime_s"] = millis() / 1000;
  doc["rssi_dbm"] = WiFi.RSSI();
  doc["reset_reason"] = sys::watchdog::resetReasonName();
  JsonObject relays = doc["relays"].to<JsonObject>();
  api::state::fillRelays(relays);
  JsonObject sensors = doc["sensors"].to<JsonObject>();
  api::state::fillSensors(sensors);
  JsonArray acks = doc["acks"].to<JsonArray>();
  const AckQueue& queue = ackQueue();
  for (size_t i = 0; i < queue.count; ++i) {
    const Ack& ack = queue.items[i];
    JsonObject entry = acks.add<JsonObject>();
    entry["id"] = ack.id;
    entry["ok"] = ack.ok;
    entry["httpStatus"] = ack.httpStatus;
    if (!ack.error.isEmpty()) {
      entry["error"] = ack.error;
    }
  }
  String body;
  serializeJson(doc, body);
  return body;
}

inline void processResponse(const String& body) {
  JsonDocument doc;
  if (deserializeJson(doc, body) != DeserializationError::Ok) {
    Serial.println("[hub][sync] could not parse response");
    return;
  }
  for (JsonObject command : doc["commands"].as<JsonArray>()) {
    const char* id = command["id"] | "";
    const char* action = command["action"] | "";
    const char* target = command["target"] | "";
    if (*id == '\0') {
      Serial.println("[hub][sync] command without id ignored");
      continue;
    }
    if (executeCommand(action, target)) {
      enqueueAck(id, true, 200);
      Serial.printf("[hub][sync] applied %s %s (id %.8s)\n", action, target, id);
    } else {
      enqueueAck(id, false, 400, "unknown command");
      Serial.printf("[hub][sync] rejected unknown command (id %.8s)\n", id);
    }
  }
}

// Minimal HTTP POST over a raw WiFiClient.
//
// HTTPClient is intentionally NOT used: on this board (ESP32-S3, arduino-esp32
// 3.3.x) its request flow panics the closed-source WiFi driver ~100 ms after
// the first POST (lmacProcessCtsTimeout -> rcReachRetryLimit, LoadProhibited).
// The raw flow below was validated clean on hardware for 30+ cycles. Request
// goes out as a single write (Nagle coalesces it into one TCP segment).
inline void httpPost(const String& path, const String& body, String& response, int& statusCode) {
  statusCode = -2;  // invalid url in NVS
  const Config& cfg = config();
  String host = cfg.url;
  const int scheme = host.indexOf("://");
  if (scheme < 0) {
    return;
  }
  host = host.substring(scheme + 3);
  uint16_t port = 80;
  const int colon = host.lastIndexOf(':');
  if (colon >= 0) {
    port = static_cast<uint16_t>(host.substring(colon + 1).toInt());
    host = host.substring(0, colon);
  }
  if (host.isEmpty() || port == 0) {
    return;
  }

  statusCode = -1;  // connection failed
  WiFiClient client;
  client.setTimeout(kHttpTimeoutMs);
  if (!client.connect(host.c_str(), port)) {
    return;
  }

  String request;
  request.reserve(256 + cfg.token.length() + body.length());
  request += "POST " + path + " HTTP/1.0\r\n";
  request += "Host: " + host + ":" + String(port) + "\r\n";
  request += "Content-Type: application/json\r\n";
  request += "Authorization: Bearer " + cfg.token + "\r\n";
  request += "Content-Length: " + String(body.length()) + "\r\n";
  request += "Connection: close\r\n\r\n";
  request += body;
  client.write(reinterpret_cast<const uint8_t*>(request.c_str()), request.length());

  // Read until the server closes (HTTP/1.0 + Connection: close) or timeout.
  const unsigned long deadline = millis() + kHttpTimeoutMs;
  while (millis() < deadline && (client.connected() || client.available())) {
    while (client.available()) {
      response += static_cast<char>(client.read());
    }
    if (response.length() > 8192 || (!client.connected() && !client.available())) {
      break;
    }
    delay(1);
  }
  client.stop();

  if (!response.startsWith("HTTP/")) {
    statusCode = -1;
    return;
  }
  const int space = response.indexOf(' ');
  statusCode = (space >= 0) ? response.substring(space + 1, space + 4).toInt() : 0;
  if (statusCode <= 0) {
    statusCode = -1;
  }
}

inline void syncOnce() {
  String response;
  int httpStatus = 0;
  httpPost("/board/sync", buildPayload(), response, httpStatus);
  if (httpStatus == 200) {
    // The queue did not change between building the payload and this point
    // (single-threaded loop), so clearing now removes exactly the acks that
    // were sent; acks for commands below enqueue after the clear.
    ackQueue().count = 0;
    const int bodyStart = response.indexOf("\r\n\r\n");
    if (bodyStart >= 0) {
      processResponse(response.substring(bodyStart + 4));
    }
    reportStatus(200);
    return;
  }
  reportStatus(httpStatus);
}

}  // namespace

// Call after the WiFi bring-up: config comes from NVS (network-independent),
// but this keeps the boot log ordered (link first, sync client second).
inline void begin() {
  const Config& cfg = config();
  if (!cfg.enabled) {
    Serial.println("[hub][sync] push disabled: no url in NVS (namespace 'hub')");
    return;
  }
  Serial.printf("[hub][sync] push enabled -> %s/board/sync every %lu ms (mac %s)\n",
                cfg.url.c_str(), kIntervalMs, WiFi.macAddress().c_str());
}

// Runs from the loop: WiFi connected + interval elapsed -> one attempt.
inline void update() {
  const Config& cfg = config();
  if (!cfg.enabled || WiFi.status() != WL_CONNECTED) {
    return;
  }
  static unsigned long lastAttemptMs = 0;
  const unsigned long now = millis();
  if (now - lastAttemptMs < kIntervalMs) {
    return;
  }
  lastAttemptMs = now;
  syncOnce();
}

}  // namespace net::hub_sync

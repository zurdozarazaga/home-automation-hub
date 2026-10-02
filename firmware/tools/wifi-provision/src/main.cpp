// One-shot provisioning tool: writes ssid/pass into the NVS namespace
// "wifi" and (optionally) url/token into "hub" so the main firmware can read
// them at boot (src/net/wifi_nvs.h, src/net/hub_sync.h). Values come from
// build flags fed by the shell environment; nothing is stored in the repo.
// After a successful run, reflash the main firmware.
#include <Arduino.h>
#include <Preferences.h>

#ifndef WIFI_SSID
#error "WIFI_SSID is not defined: run WIFI_SSID='net' WIFI_PASS='pass' pio run -t upload"
#endif
#ifndef WIFI_PASS
#error "WIFI_PASS is not defined: run WIFI_SSID='net' WIFI_PASS='pass' pio run -t upload"
#endif

// Empty values (env var set but blank) would write useless credentials.
static_assert(sizeof(WIFI_SSID) > 1, "WIFI_SSID is empty; set the WIFI_SSID env var");
static_assert(sizeof(WIFI_PASS) > 1, "WIFI_PASS is empty; set the WIFI_PASS env var");

// HUB_URL / HUB_TOKEN are optional: when the env vars are unset (or empty)
// the defines arrive empty and the existing "hub" keys stay untouched.

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("[provision] writing credentials to NVS...");

  Preferences prefs;
  if (!prefs.begin("wifi", /*readOnly=*/false)) {
    Serial.println("[provision] ERROR: could not open NVS namespace 'wifi'");
    return;
  }
  const size_t ssidBytes = prefs.putString("ssid", WIFI_SSID);
  const size_t passBytes = prefs.putString("pass", WIFI_PASS);
  prefs.end();

  Serial.printf("[provision] saved ssid \"%s\" (%u bytes) and password (%u bytes)\n",
                WIFI_SSID,
                static_cast<unsigned>(ssidBytes),
                static_cast<unsigned>(passBytes));

  // Optional hub sync keys (push link mode): written only when non-empty.
  bool hubWrote = false;
  if (!prefs.begin("hub", /*readOnly=*/false)) {
    Serial.println("[provision] ERROR: could not open NVS namespace 'hub'");
    return;
  }
#ifdef HUB_URL
  if (sizeof(HUB_URL) > 1) {
    const size_t urlBytes = prefs.putString("url", HUB_URL);
    Serial.printf("[provision] saved hub url \"%s\" (%u bytes)\n",
                  HUB_URL,
                  static_cast<unsigned>(urlBytes));
    hubWrote = true;
  }
#endif
#ifdef HUB_TOKEN
  if (sizeof(HUB_TOKEN) > 1) {
    // Never print the token itself, only its size.
    const size_t tokenBytes = prefs.putString("token", HUB_TOKEN);
    Serial.printf("[provision] saved hub token (%u bytes)\n",
                  static_cast<unsigned>(tokenBytes));
    hubWrote = true;
  }
#endif
  prefs.end();

  if (!hubWrote) {
    Serial.println(
        "[provision] hub url/token not provided; push stays disabled (keys untouched)");
  }

  Serial.println("[provision] done. Now reflash the main firmware:");
  Serial.println("[provision]   pio run -d firmware/esp32 -t upload");
}

void loop() {
  delay(1000);
}

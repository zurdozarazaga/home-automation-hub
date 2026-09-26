// One-shot WiFi provisioning tool: writes ssid/pass into the NVS namespace
// "wifi" so the main firmware can read them at boot (src/net/wifi_nvs.h).
// Credentials come from build flags fed by the shell environment; nothing is
// stored in the repo. After a successful run, reflash the main firmware.
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

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("[provision] writing WiFi credentials to NVS namespace 'wifi'...");

  Preferences prefs;
  if (!prefs.begin("wifi", /*readOnly=*/false)) {
    Serial.println("[provision] ERROR: could not open NVS");
    return;
  }
  const size_t ssidBytes = prefs.putString("ssid", WIFI_SSID);
  const size_t passBytes = prefs.putString("pass", WIFI_PASS);
  prefs.end();

  Serial.printf("[provision] saved ssid \"%s\" (%u bytes) and password (%u bytes)\n",
                WIFI_SSID,
                static_cast<unsigned>(ssidBytes),
                static_cast<unsigned>(passBytes));
  Serial.println("[provision] done. Now reflash the main firmware:");
  Serial.println("[provision]   pio run -d firmware/esp32 -t upload");
}

void loop() {
  delay(1000);
}

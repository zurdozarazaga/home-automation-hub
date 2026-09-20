#pragma once
// sys/build_info.h - Build-time facts surfaced over HTTP and Serial.
//
// FW_VERSION: bumped per release so an OTA update can be verified over HTTP
// (GET /health "fw" field). The fallback keeps bare/IDE builds working.
//
// OTA credentials never live in the repo: OTA_USER / OTA_PASS arrive as
// build defines (see firmware/README.md). When they are missing or empty,
// OTA stays disabled with an explicit warning instead of exposing an
// unauthenticated upload endpoint.

#include <string.h>

#ifndef FW_VERSION
#define FW_VERSION "0.0.0-dev"
#endif

#if defined(OTA_USER) && defined(OTA_PASS)
#define HUB_OTA_CREDENTIALS_PRESENT 1
#else
#define HUB_OTA_CREDENTIALS_PRESENT 0
#endif

namespace sys::build_info {

constexpr const char* version() { return FW_VERSION; }

// True only when both credentials are defined AND non-empty. The length
// check is runtime because -DOTA_USER="" is still "defined".
inline bool otaEnabled() {
  static const bool enabled = []() -> bool {
#if HUB_OTA_CREDENTIALS_PRESENT
    return strlen(OTA_USER) > 0 && strlen(OTA_PASS) > 0;
#else
    return false;
#endif
  }();
  return enabled;
}

}  // namespace sys::build_info

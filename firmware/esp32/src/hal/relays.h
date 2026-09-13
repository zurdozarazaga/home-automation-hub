#pragma once
// hal/relays.h - Hardware abstraction for the relay outputs.
//
// This slice: stubs only. No GPIO is driven here on purpose; the real pin
// mapping lands in the relay slice (roadmap step 2). applySafeState() runs
// first in setup() so future outputs always boot into a safe state.

#include <Arduino.h>

namespace hal::relays {

// Unassigned on purpose: real GPIO numbers arrive with the relay slice.
// TODO(relay-slice): assign RIEGO/LUCES pins and drive them here.
inline void applySafeState() {
  Serial.println("[hub][hal] relays -> safe state (OFF, stub: no GPIO driven yet)");
}

inline const char* riegoState() { return "off"; }
inline const char* lucesState() { return "off"; }

inline void setRiego(bool on) {
  Serial.printf("[hub][hal] riego %s (stub: not applied to GPIO yet)\n", on ? "ON" : "OFF");
}

inline void setLuces(bool on) {
  Serial.printf("[hub][hal] luces %s (stub: not applied to GPIO yet)\n", on ? "ON" : "OFF");
}

}  // namespace hal::relays

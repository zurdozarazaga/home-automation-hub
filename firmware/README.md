# Firmware ESP32-S3

Scaffold inicial del firmware de la placa ESP32-S3 DevKitC-1 para el Home Automation Hub. Todo se verifica sin placa (compilación + CI); solo `upload` y `monitor` requieren el hardware.

## Alcance de este slice

- Hola por Serial, WiFi con credenciales desde NVS y reconexión.
- `GET /health` y `GET /estado` con JSON de estado.
- `POST /riego/on|off` y `POST /luces/on|off` como stubs que solo registran en el log (el GPIO real llega en el siguiente slice).
- Tabla de particiones con OTA desde el día 1 (`factory` + `ota_0` + `ota_1`).
- Estructura `hal/` (salidas físicas), `net/` (WiFi/red), `api/` (rutas HTTP) para poder migrar a ESP-IDF sin reescribir.

## Contrato HTTP (lo que el backend consume)

| Método + ruta       | Respuesta en este slice                          |
|---------------------|--------------------------------------------------|
| `GET /health`       | 200 + `{status, uptime_s, free_heap}`            |
| `GET /estado`       | 200 + `{status, uptime_s, free_heap, rssi_dbm, relays}` |
| `POST /riego/on`    | 200 + `{ok, target, action, applied: false, note}` (stub) |
| `POST /riego/off`   | 200 + stub                                       |
| `POST /luces/on`    | 200 + stub                                       |
| `POST /luces/off`   | 200 + stub                                       |

El backend mapea `POST /devices/:deviceId/actions {action, target}` a estas rutas. Si la placa no responde, el backend devuelve 502 y guarda el `ActionLog` como `failed`.

## Requisitos

- VS Code con la extensión **pioarduino IDE** (es el fork comunitario; la extensión oficial de PlatformIO usa el platform oficial, estancado en Arduino Core 2.x, y no sirve para este proyecto).
- Alternativa por CLI: Python 3.10+ y `pip install pioarduino`. Los comandos `pio` son los mismos.
- Sin hardware: basta con el CLI para compilar y con el CI de GitHub como verificación.

## Comandos

```bash
# Compilar (sin placa, el paso que valida este slice)
pio run -d firmware/esp32

# Flashear por USB (requiere la placa)
pio run -d firmware/esp32 -t upload

# Consola serie a 115200 baudios (requiere la placa)
pio device monitor -d firmware/esp32
```

## Primer flash (solo con placa)

1. Conecta la S3 por USB (usa el puerto USB nativo, con `ARDUINO_USB_CDC_ON_BOOT=1` el serie aparece solo).
2. Si el primer flash falla o queda colgado, pon la placa en modo DOWNLOAD: mantén pulsado BOOT, pulsa y suelta RESET, suelta BOOT. Luego ejecuta `pio run -d firmware/esp32 -t upload`.
3. Tras un flash correcto, pulsa RESET una vez. Los siguientes flashes ya son normales.
4. Abre el monitor y espera el `hello from ESP32-S3` más las líneas `[hub][hal]`, `[hub][net]` y `[hub][api]`.

## Secretos por NVS (nunca en el repo)

Las credenciales WiFi viven en NVS (espacio `wifi`, claves `ssid` y `pass`). Está prohibido quemarlas con `-D` o constantes en el código. Para grabarlas una vez por USB, flashea un sketch temporal como este y luego vuelve a flashear el firmware normal:

```cpp
#include <Preferences.h>
void setup() {
  Preferences prefs;
  prefs.begin("wifi", false);
  prefs.putString("ssid", "TU_RED");
  prefs.putString("pass", "TU_CLAVE");
  prefs.end();
}
void loop() {}
```

## Qué verifica cada paso sin placa

| Paso | Comando | Qué prueba |
|------|---------|------------|
| Compilación local | `pio run -d firmware/esp32` | Todo el C++ compila contra Arduino Core 3.x |
| CI | push/PR (workflow `Firmware CI`) | Lo mismo en Ubuntu limpio + guardarraíl anti-secretos |
| Anti-secretos | `grep -rniE 'WiFi\.begin\(\s*"' firmware/esp32/src` (vacío = bien) | Nadie quemó credenciales en el código |
| Limpieza | `git status` | Solo archivos nuevos del firmware, nada en backend/frontend |

## Estructura

```text
firmware/esp32/
  platformio.ini        entorno esp32-s3-devkitc-1 (pioarduino, Arduino, LittleFS)
  partitions.csv        factory + ota_0 + ota_1 + NVS + LittleFS (flash 8 MB)
  src/main.cpp          arranque: Serial, fail-safe, WiFi, rutas, OTA
  src/hal/relays.h      salidas físicas (stubs en este slice)
  src/net/wifi_nvs.h    WiFi STA desde NVS + reconexión
  src/api/web_routes.h  contrato HTTP + JSON de estado
```

## Roadmap (de `docs/aprendizaje/02-integrando-el-esp32.md`)

Siguiente slice: GPIO real de relés. Después, en orden: sensor, watchdog + fail-safe completo, OTA funcional verificada, MQTT (n8n nunca publica directo a la placa), e2e NestJS → placa y endurecimiento.

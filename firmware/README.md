# Firmware ESP32-S3

Firmware de la placa ESP32-S3 DevKitC-1 para el Home Automation Hub. Todo se verifica sin placa (compilación + CI); solo `upload`, `monitor` y las pruebas con hardware requieren la placa.

## Alcance de este slice

- GPIO real de relés: `riego` en GPIO4 y `luces` en GPIO5 (active-low, fail-safe OFF al arranque).
- `POST /riego/on|off` y `POST /luces/on|off` accionan hardware y responden con el estado resultante.
- `GET /estado` reporta el estado real leído del hardware (ya no estático); `GET /health` sin cambios.
- Tabla de cableado y orden de pruebas para cuando llegue la placa.
- Sensor DHT22 en GPIO15: `GET /estado` suma objeto `sensors` con la última lectura cacheada (intervalo 10 s); flag `SENSOR_FAKE` para validar el JSON sin sensor cableado.
- WiFi desde NVS, OTA y particiones sin cambios.

## Contrato HTTP (lo que el backend consume)

| Método + ruta       | Respuesta en este slice                          |
|---------------------|--------------------------------------------------|
| `GET /health`       | 200 + `{status, uptime_s, free_heap}`            |
| `GET /estado`       | 200 + `{status, uptime_s, free_heap, rssi_dbm, relays, sensors}` (`sensors`: `{temperature_c, humidity_pct, valid, age_s}`; nulos hasta la primera lectura) |
| `POST /riego/on`    | 200 + `{ok, target, action, state, applied: true}` (acciona GPIO4) |
| `POST /riego/off`   | 200 + estado resultante                                       |
| `POST /luces/on`    | 200 + `{ok, target, action, state, applied: true}` (acciona GPIO5) |
| `POST /luces/off`   | 200 + estado resultante                                       |

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

## Cableado de relés (solo con placa)

Módulo de 2 canales con optoacoplador, lógica active-low (LOW = relé ON).

| Señal ESP32 | Módulo | Notas |
|-------------|--------|-------|
| GPIO4 | IN1 | `riego` |
| GPIO5 | IN2 | `luces` |
| 3V3 | VCC | lado lógico del optoacoplador (quitar el jumper JD-VCC) |
| GND | GND | tierra común con la fuente de 5 V |
| (fuente 5 V dedicada) | JD-VCC | alimenta las bobinas, NO sale de la placa |

Reglas:

- Nunca alimentes la bobina desde un pin GPIO: el pin entrega lógica a 3,3 V y pocos mA; cada bobina pide ~70 mA a 5 V y tumbaría o dañaría la S3.
- Quita el jumper JD-VCC para separar la alimentación de bobinas (5 V externos) de la lógica (3V3 de la placa); une las tierras.
- El fail-safe está en el firmware: al arrancar, ambos canales quedan en OFF antes de WiFi y del servidor.

Orden de pruebas cuando llegue la placa:

1. LED RGB interno (GPIO48): valida flasheo y arranque sin cablear nada.
2. LED + resistencia a GND en GPIO4: valida niveles de salida.
3. Un canal del relé sin carga (escucha el clic, mide continuidad COM/NO): valida polaridad active-low y cableado.
4. Relé con carga real: prueba final.
5. DHT22 con `SENSOR_FAKE` primero (valida la forma del JSON en `/estado` sin cablear), luego cableado (valores reales en el log y en `/estado`).

## Cableado DHT22 (solo con placa)

| Señal ESP32 | DHT22 | Notas |
|-------------|-------|-------|
| 3V3 | VCC | alimentación del sensor |
| GPIO15 | DATA | con pull-up externo de 4,7 kΩ–10 kΩ a 3V3 (salvo que tu módulo ya lo traiga) |
| GND | GND | tierra común |

Reglas:

- El DHT22 exige ≥ 2 s entre lecturas: el firmware cachea y relee como máximo cada 10 s; los handlers HTTP solo sirven el caché para no bloquear el servidor.
- Sin lectura válida aún (sensor tibio o fallando), `sensors` responde `valid: false` con valores nulos y `age_s` nulo.

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
  src/hal/relays.h      relés reales en GPIO4/5 (active-low, fail-safe)
  src/sensors/dht22.h   DHT22 en GPIO15 (lectura cacheada + modo SENSOR_FAKE)
  src/net/wifi_nvs.h    WiFi STA desde NVS + reconexión
  src/api/web_routes.h  contrato HTTP + JSON de estado
```

## Roadmap (de `docs/aprendizaje/02-integrando-el-esp32.md`)

Hecho: GPIO real de relés y sensor DHT22. Siguiente, en orden: watchdog + fail-safe completo, OTA funcional verificada, MQTT (n8n nunca publica directo a la placa), e2e NestJS → placa y endurecimiento.

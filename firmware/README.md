# Firmware ESP32-S3

Firmware de la placa ESP32-S3 DevKitC-1 para el Home Automation Hub. Todo se verifica sin placa (compilación + CI); solo `upload`, `monitor` y las pruebas con hardware requieren la placa.

## Alcance de este slice

- Task Watchdog sobre el loop principal (10 s, panic + reset) con gracia de arranque y ventana estirada durante OTA; `reset_reason` visible en `/health`.
- OTA funcional con ElegantOTA: portal `/update` con auth por defines de build, versión visible (`FW_VERSION` en `/health`) y confirmación de imagen lista para rollback.
- Env `esp32-s3-devkitc-1-debug` para banco/CI: compila la rama con credenciales OTA, el hook `/debug/hang` y `SENSOR_FAKE`, que el env default no compila.
- Relés GPIO4/5, sensor DHT22 y WiFi por NVS sin cambios.

## Contrato HTTP (lo que el backend consume)

| Método + ruta       | Respuesta en este slice                          |
|---------------------|--------------------------------------------------|
| `GET /health`       | 200 + `{status, fw, reset_reason, ota_enabled, uptime_s, free_heap}` |
| `GET /estado`       | 200 + `{status, uptime_s, free_heap, rssi_dbm, relays, sensors}` (`sensors`: `{temperature_c, humidity_pct, valid, age_s}`; nulos hasta la primera lectura) |
| `POST /riego/on`    | 200 + `{ok, target, action, state, applied: true}` (acciona GPIO4) |
| `POST /riego/off`   | 200 + estado resultante                                       |
| `POST /luces/on`    | 200 + `{ok, target, action, state, applied: true}` (acciona GPIO5) |
| `POST /luces/off`   | 200 + estado resultante                                       |
| `POST /debug/hang`  | 200 + bloquea el loop a propósito para probar el watchdog (solo env debug: `DEBUG_HANG`) |

El backend mapea `POST /devices/:deviceId/actions {action, target}` a estas rutas. Si la placa no responde, el backend devuelve 502 y guarda el `ActionLog` como `failed`.

## Requisitos

- VS Code con la extensión **pioarduino IDE** (es el fork comunitario; la extensión oficial de PlatformIO usa el platform oficial, estancado en Arduino Core 2.x, y no sirve para este proyecto).
- Alternativa por CLI: Python 3.10+ y `pip install pioarduino`. Los comandos `pio` son los mismos.
- Sin hardware: basta con el CLI para compilar y con el CI de GitHub como verificación.

## Comandos

```bash
# Compilar (sin placa): sin -e compila los dos envs (default + debug)
pio run -d firmware/esp32

# Flashear por USB el env normal (requiere la placa)
pio run -d firmware/esp32 -t upload

# Env de banco/CI: credenciales OTA de prueba, /debug/hang y SENSOR_FAKE
pio run -d firmware/esp32 -e esp32-s3-devkitc-1-debug -t upload

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

## Watchdog (recuperación automática)

- El firmware suscribe el loop principal al Task Watchdog del ESP32 con timeout de **10 s** y `panic + reset`: un cuelgue real reinicia la placa en vez de dejarla muda.
- Por qué 10 s: una iteración sana tarda ~100 ms (HTTP + WiFi + lectura cacheada del sensor), así que 10 s es ~100 veces el período normal — margen de sobra para no dispararse en operación sana y aún así reaccionar antes de que una persona note el cuelgue.
- Ventana de gracia de arranque (30 s): el bring-up de WiFi puede bloquear hasta sus propios 10 s; al terminar `setup()` la ventana se ajusta a 10 s.
- Durante un OTA la ventana se estira a 120 s y se alimenta por chunk subido: `Update.begin()` borra la partición completa y el servidor es síncrono, así que el loop queda bloqueado a propósito. Una transferencia estancada más allá de la ventana igual termina en reset (seguro: la imagen incompleta nunca se bootea).
- No se vigilan las tareas idle a propósito: las escrituras de flash del OTA pausan ambos cores y una suscripción idle dispararía en falso.
- Recuperación sin intervención humana: cuelgue → panic → reset → boot → fail-safe (relés OFF) → WiFi → servidor.
- Verificación en placa: `GET /health` expone `"reset_reason"` (por ejemplo `"POWERON"`, `"SW"` o `"TASK_WDT"`).
- Prueba en banco (env debug): 1) flasheá `-e esp32-s3-devkitc-1-debug`; 2) `curl -X POST http://<ip>/debug/hang`; 3) a los ~10 s la placa resetea y el serie muestra el panic del watchdog; 4) `GET /health` muestra `"reset_reason": "TASK_WDT"`.

## OTA por aire (ElegantOTA)

### Credenciales y estado

- Portal en `http://<ip>/update` con auth HTTP básica. **Sin credenciales definidas la OTA queda deshabilitada** con aviso claro por serie: nunca se expone un upload sin auth.
- Las credenciales llegan por defines de build y jamás se commitean. Para uso local, creá `firmware/esp32/platformio_override.ini` (ignorado por git) con un env propio:

```ini
[env:esp32-s3-devkitc-1-ota]
extends = env:esp32-s3-devkitc-1
build_flags =
  ${env.build_flags}
  -DFW_VERSION=\"0.5.0\"
  -DOTA_USER=\"tu-usuario\"
  -DOTA_PASS=\"tu-clave-larga\"
```

  y compilá/flasheá con `pio run -d firmware/esp32 -e esp32-s3-devkitc-1-ota -t upload`. PlatformIO carga `platformio_override.ini` automáticamente; si tu setup no lo hace, agregalo con la opción `extra_configs`.

### Protocolo de prueba (cuando llegue la placa)

1. Primer flash por USB (ver "Primer flash"), con un binario que tenga `FW_VERSION` y credenciales definidas.
2. Verificá `GET /health` → `"fw": "X"` y `"ota_enabled": true`.
3. Abrí `http://<ip>/update`, logueate y subí el `.bin` de un build con otro `FW_VERSION` (compilalo antes con `pio run -d firmware/esp32`; el binario queda en `.pio/build/esp32-s3-devkitc-1/firmware.bin`).
4. ElegantOTA reinicia solo (~2 s). Verificá `GET /health` → `"fw"` cambió, `"uptime_s"` chico y `"reset_reason": "SW"`.
5. Si la subida se interrumpe, la partición destino queda a medio escribir pero **nunca se bootea**: el `otadata` recién se actualiza al final del proceso.

### Rollback del bootloader (estado y cómo activarlo)

- Mecanismo IDF: con `CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE`, la primera imagen que llega por OTA arranca en estado `PENDING_VERIFY` y tiene **un solo intento**: si no confirma con `esp_ota_mark_app_valid_cancel_rollback()`, el bootloader la marca abortada y vuelve a la imagen anterior.
- Este firmware ya implementa la parte de la app (`src/sys/ota_confirm.h`): confirma automáticamente 30 s después de un arranque sano (sobrevivir la ventana = sano; un crash/panic antes termina en rollback). Con rollback deshabilitado, esa confirmación es un no-op seguro.
- Con la plataforma actual (pioarduino 55.03.39) el core viene prebuilt con el default de IDF (rollback deshabilitado) y **no se puede activar sin `custom_sdkconfig`**, que reconstruye IDF + Arduino desde fuentes: el build de CI pasaría de ~3 min a decenas de minutos y, además, esta revisión arrastra el bug de copia de archivos (`copy_idf_component_archives` falta en 55.03.38/38-1/39), lo que hace poco confiable lo que realmente llega al binario. Por eso queda **documentado y listo, no activado**.
- Para activarlo (idealmente tras subir la plataforma a una revisión con el fix), agregá esta opción al env — va junto a `build_flags`, no dentro de ellos:
  ```ini
  custom_sdkconfig = CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=y
  ```
  y asumí el costo de build. Antes de confiar, verificá qué traía el prebuilt:
  `grep BOOTLOADER_APP_ROLLBACK ~/.platformio/packages/framework-arduinoespressif32-libs/esp32s3/sdkconfig.orig`
  (ese archivo es la config real del prebuilt; los `sdkconfig.*` del proyecto son solo el pedido).
- Plan de prueba de rollback (con rollback ya activado):
  1. USB: flasheá una versión A sana y verificá que arranca y queda `VALID`.
  2. OTA: subí una versión B que cuelgue en `setup()` (por ejemplo, un `while (true);` temporal al inicio).
  3. B no llega a confirmar: **un solo reset** (manual, o del watchdog si el cuelgue ocurre después de armarlo) alcanza para que el bootloader la abandone.
  4. Verificá que volvió A: `GET /health` → `"fw"` de A; el serie muestra el bootloader eligiendo la partición anterior.
  5. Nota: un OTA nuevo solo puede empezar desde una imagen `VALID`; por eso importa confirmar temprano y no dejar la placa en `PENDING_VERIFY`.

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
| Compilación local | `pio run -d firmware/esp32` | Compila los **dos envs** (default + debug): cubre ambas ramas de cada `#if` (credenciales OTA presentes/ausentes, sensor real/fake, hook de hang) |
| CI | push/PR (workflow `Firmware CI`) | Lo mismo en Ubuntu limpio + guardarraíl anti-secretos |
| Anti-secretos | `grep -rniE 'WiFi\.begin\(\s*"' firmware/esp32/src` (vacío = bien) | Nadie quemó credenciales en el código |
| Limpieza | `git status` | Solo archivos nuevos del firmware, nada en backend/frontend |

## Estructura

```text
firmware/esp32/
  platformio.ini        envs esp32-s3-devkitc-1 y -debug (pioarduino, Arduino, LittleFS)
  partitions.csv        factory + ota_0 + ota_1 + NVS + LittleFS (flash 8 MB)
  src/main.cpp          arranque: Serial, fail-safe, watchdog, WiFi, OTA, rutas
  src/hal/relays.h      relés reales en GPIO4/5 (active-low, fail-safe)
  src/sensors/dht22.h   DHT22 en GPIO15 (lectura cacheada + modo SENSOR_FAKE)
  src/sys/watchdog.h    Task Watchdog + reset reason (gracia de boot y OTA)
  src/sys/build_info.h  FW_VERSION + gate de credenciales OTA
  src/sys/ota_confirm.h confirmación de imagen post-OTA (rollback-ready)
  src/net/wifi_nvs.h    WiFi STA desde NVS + reconexión
  src/api/web_routes.h  contrato HTTP + JSON de estado
```

## Roadmap (de `docs/aprendizaje/02-integrando-el-esp32.md`)

Hecho: GPIO real de relés, sensor DHT22, watchdog y OTA con auth + versión. Siguiente, en orden: MQTT (n8n nunca publica directo a la placa), e2e NestJS → placa y endurecimiento. Pendiente de decisión: activar el rollback del bootloader (ver sección OTA; requiere `custom_sdkconfig` y subir la plataforma).

# Bring-up del hardware: de firmware sin placa al primer arranque real

La serie 01–03 contó qué estamos construyendo, cómo se integra el ESP32 y los primeros desafíos. Este documento (04) cierra otra etapa: cómo se dejó **todo el sistema verificable en local**, cómo se preparó la placa **ESP32-S3-N16R8** y qué apareció en el **primer contacto con el hardware real** — incluidos tres bugs que ninguna compilación podía ver. Es materia prima directa para el artículo.

## Quick path

1. Si vas directo a las historias de debugging: "El día del bring-up" tiene los tres bugs con diagnóstico, causa raíz y fix.
2. Si te interesa el método: "Lecciones" destila las prácticas que permitieron llegar a la placa con todo funcionando.
3. Evidencia completa: PRs #16–#21 y los comandos del apéndice.

## Cómo veníamos (resumen de 01–03)

- **Backend NestJS**: JWT + RBAC con guards globales y rol `service` para n8n (n8n decide, el backend ejecuta y audita), telemetría con seam de ingesta, dispatcher in-memory/prisma, 502 auditado cuando la placa no responde.
- **Frontend Next.js**: dashboard dark/mobile-first; llamadas server-side al backend.
- **Firmware ESP32-S3**: scaffold con pioarduino (Arduino 3.x sobre IDF 5.5), particiones con OTA desde el día uno.
- **Disciplina sin placa**: cada slice se entrega "compilando, respetando el contrato y bien diseñado"; la verificación es el CI. La placa después solo se conecta y se le pasa el software.

## Etapa 1 — Firmware por slices (PRs #14–#18)

| Slice | Qué agregó | Cómo se verificó |
|---|---|---|
| Scaffold (#14) | pioarduino 55.03.39, particiones `factory + ota_0 + ota_1 + NVS + LittleFS`, ElegantOTA, servidor síncrono | Build en CI (pioarduino exige Python ≥ 3.10) |
| Relés (#16) | GPIO4 riego / GPIO5 luces, active-low, fail-safe; `static_assert` que prohíbe pines de strapping/USB/UART/LED/flash/PSRAM; `/estado` lee hardware real | Build + contrato |
| DHT22 (#17) | GPIO15, lectura cacheada cada 10 s (el sensor exige ≥ 2 s), `sensors{temperature_c, humidity_pct, valid, age_s}` en `/estado`, modo `SENSOR_FAKE` | Build + forma del JSON |
| Watchdog + OTA (#18) | Task WDT 10 s panic+reset (gracia de boot 30 s, ventana OTA 120 s); `reset_reason` en `/health`; OTA con auth por defines (deshabilitada sin credenciales) + versión visible; confirmación rollback-ready | Build + env debug de CI que compila ambas ramas de cada `#if` |

Decisiones que después importaron: **fail-safe primero** (relés OFF antes de WiFi/servidor), **servidor síncrono** (lo exige ElegantOTA), y **nada de credenciales en el repo** (WiFi por NVS, credenciales OTA por build flags).

## Etapa 2 — Auditoría y hardening full-stack (PR #19)

Antes de la placa se auditó el flujo completo: ¿el frontend habla de verdad con el backend? ¿el backend con la placa? ¿los tests prueban lo que importa?

| Hallazgo | Impacto | Fix |
|---|---|---|
| El dashboard caía siempre a mocks (no mandaba token; el 401 era silencioso) | La UI "funcionaba" sin datos reales y ocultaba fallas | Login real (`POST /auth/login`, cookie httpOnly), se eliminó el fallback silencioso, estados explícitos de error/vacío |
| Telemetría 403 para todos (sin `@Roles` + guard deny-by-default) | Ingesta y consulta inutilizables | Matriz de roles: `service` ingesta; `admin`/`viewer` consultan |
| Transporte al ESP32 sin timeout | Placa colgada = request colgada | `AbortSignal.timeout(5000)` → 502 rápido y auditado |
| `status` de los devices nunca se actualizaba | Todo "offline" para siempre | Poller **pull**: `GET /estado` cada 30 s → status online/offline + ingesta de temperatura/humedad |
| El e2e solo era verde con Postgres + `DATA_SOURCE=prisma`, y el CI no lo corría | Suite de segunda clase | e2e en CI con servicio Postgres + suite idempotente |

Verificación observada: 108 tests unit + 22 e2e (corridos dos veces), y un smoke end-to-end real (login → dashboard con telemetría del poller → acción → logout) contra Postgres y una placa ESP32 simulada.

## Etapa 3 — La placa: ESP32-S3-N16R8 (PR #20)

La unidad es una **N16R8**: 16 MB de flash QIO + 8 MB de PSRAM octal. Eso exigió:

- `board_build.flash_size = 16MB`, `board_upload.flash_size = 16MB` y `board_build.arduino.memory_type = qio_opi`. Verificado: el build enlaza la variante `qio_opi` y esptool autodetecta 16 MB.
- Toolchain local: `brew install python@3.12` + `pipx install pioarduino` (el CI usa `pip install -U pioarduino`).
- **Herramienta de provisioning** (`firmware/tools/wifi-provision/`): graba ssid/pass en NVS desde variables de entorno (nunca al repo; valores vacíos fallan en compilación). El firmware principal lee ese NVS al boot.
- Plan de bring-up ordenado: LED interno → LED en GPIO4 → relé sin carga → con carga → DHT22 (`SENSOR_FAKE` primero) → WDT → OTA.

## Etapa 4 — El día del bring-up (PR #21)

### El flash: BOOT+RESET y el puerto que cambia de nombre

Primer `pio run -t upload` por el puerto **USB nativo** (el etiquetado `USB`; `COM` es el puente UART): `No serial data received`. La placa nueva necesitaba el baile de modo download — mantener BOOT, tocar RESET, soltar BOOT. Dato no obvio: **al resetear, el nombre del puerto serie cambia** (`usbmodem1234561` → `usbmodem1101`), así que reintentar contra el nombre viejo falla aunque la placa esté lista y esperando. Lección de tooling: detectar el puerto por patrón.

Segundo dato: esptool confirmó el hardware en el primer contacto — `Embedded PSRAM 8MB`, `Auto-detected flash size: 16MB`, MAC `c0:4e:30:07:de:10`.

### Bug 1 — Crash loop: `server.begin()` sin lwIP

Primer arranque: el firmware saludaba, configuraba todo… y moría con `assert failed: xQueueSemaphoreTake` justo antes de `HTTP listening`. Reset y a repetir, infinito.

Diagnóstico: capturar el serie y resolver el backtrace contra el ELF exacto:

```bash
xtensa-esp32s3-elf-addr2line -pfiaC -e firmware/esp32/.pio/build/esp32-s3-devkitc-1/firmware.elf <direcciones>
```

La cadena resolvió limpia: `setup() → WebServer::begin → NetworkServer::begin → lwip_socket → netconn_new → tcpip_send_msg_wait_sem → sys_mutex_lock → assert`. Causa raíz: **sin credenciales WiFi en NVS, `connectFromNvs()` salía antes de `WiFi.mode()` y lwIP nunca se inicializaba**; el server HTTP no puede pedir un socket sin stack de red. Con WiFi configurado no pasaba — pero "arranca sin provisionar" es un estado válido (y era el nuestro).

Fix: inicializar el stack WiFi siempre, antes de cualquier salida temprana, más un flag `provisioned` para que el loop de reconexión no haga ruido en placas sin provisionar.

### Bug 2 — El fail-safe de relés que no enganchaba

Visible en el log del arranque real: `IO 4 is not set as GPIO. Execute digitalMode(4, OUTPUT) first`. En **Arduino core 3.x**, `digitalWrite()` antes de `pinMode()` ya no funciona: se ignora con error. El diseño original "latch OFF antes de habilitar la salida" quedaba roto — `pinMode()` habilitaba el driver con el registro en LOW y, como los módulos de relé son **active-low**, los canales quedaban **energizados** al arrancar. Con la placa pelada no pasa nada; con el módulo conectado habría energizado los relés en cada boot.

Fix: escribir el nivel seguro con la API de IDF (`gpio_set_level`) antes de habilitar las salidas. Mismo diseño glitch-free, ahora válido en core 3.x.

### Bug 3 — Spam del DHT22

Sin sensor cableado (falla esperable), el firmware imprimía `DHT22 read failed` **cada ~100 ms**. El guard de frescura empezaba con `valid &&`, así que un sensor que *nunca* leyó bien jamás activaba el freno de intervalo. Fix: cadencia real de reintento (1 por intervalo), log solo de la primera falla, y `valid=false` en fallo — el contrato HTTP devuelve nulls y el poller del backend no ingesta snapshots viejos.

### Bug 4 — Ruido de arranque del watchdog

Dos líneas `[E]` inofensivas (`TWDT already initialized`, `task not found`) por orden de llamadas. Fix: reconfigure-first (el core ya inicializa el TWDT) y el contador arranca recién cuando el loop queda suscrito.

### Verificación final

Arranque limpio hasta `[hub][api] HTTP listening on port 80`: sin crash loop, sin errores de GPIO, una sola línea del DHT22 y silencio después. Los cuatro fixes pasaron CI (build de ambos envs + backend + en frontend) y quedaron mergeados (#21, `develop` en `9e24832`).

## Comandos clave (apéndice)

```bash
# Compilar (sin placa): los dos envs
pio run -d firmware/esp32

# Flashear por USB nativo (si no sincroniza: BOOT+RESET; el puerto puede cambiar)
pio run -d firmware/esp32 -e esp32-s3-devkitc-1 -t upload -p /dev/cu.usbmodemXXXX

# Provisionar WiFi (una vez; red 2.4 GHz; credenciales por entorno, jamás al repo)
cd firmware/tools/wifi-provision
WIFI_SSID='tu-red' WIFI_PASS='tu-clave' pio run -t upload

# Resolver un backtrace de panic contra el ELF exacto que se flasheó
xtensa-esp32s3-elf-addr2line -pfiaC -e firmware/esp32/.pio/build/esp32-s3-devkitc-1/firmware.elf <addr>...
```

## Pendientes al cierre (estado al 26/09/2026)

- Provisioning WiFi en la placa + reflash del firmware principal + verificación de conexión (IP por serie).
- Registro de la placa en el hub (`npm run devices:register -- --name ... --ip <IP> --port 80`) y prueba funcional completa: relés (LED → carga real), DHT22 cableado, WDT (`POST /debug/hang` → `reset_reason: TASK_WDT`) y OTA por aire.
- Swap del nodo MQTT de n8n por HTTP `POST /devices/:id/actions` (cambio `n8n-e2e`).
- Decisión de despliegue a producción (JWT_SECRET real, migraciones, URL pública).

## Lecciones (para el artículo)

1. **El hardware destapa lo que el CI no ve**: de los tres bugs, dos eran invisibles en compilación (latch de relés en core 3.x, cadencia del sensor) y uno solo aparecía en un estado concreto (boot sin credenciales).
2. **El backtrace con el ELF exacto es oro**: `addr2line` convirtió "assert misterioso" en una cadena de llamadas legible en un minuto.
3. **Los pin maps y el fail-safe se diseñan antes**: "relés OFF antes que todo" y los `static_assert` de pines pagaron el día de la placa.
4. **Slices verificables sin hardware**: la disciplina "compila + respeta el contrato + bien diseñado" permitió llegar al bring-up con el sistema entero funcionando en local.
5. **Tooling del ecosistema ESP32**: el core 3.x rompe recetas viejas (`digitalWrite`), el USB nativo tiene sus rituales (BOOT+RESET, puerto que cambia de nombre) y la toolchain pinneada importa.
6. **El CI como red de seguridad**: cada fix entró con build de firmware + backend + frontend en verde.

# Integrar el ESP32 sin tener la placa en la mano

Se puede avanzar el firmware del ESP32-S3 sin hardware usando contrato HTTP primero + mock en el backend. Este documento deja el contrato, la decisión de toolchain y el roadmap en orden ejecutable.

## Quick path

1. Memoriza el contrato: la placa solo expone `POST /riego/on|off`, `POST /luces/on|off`, `GET /estado`, `GET /health`.
2. Desarrolla contra el mock: `DATA_SOURCE=in-memory` usa `InMemoryEsp32ClientService`, sin placa ni DB.
3. Cuando llegue la placa, compila y flashea en VS Code con PlatformIO por USB; el backend cambia a `DATA_SOURCE=prisma` sin reescribir lógica.

> Estado real: scaffold `firmware/` mergeado a `develop` (PR #14, ESP32-S3). Compila en CI (pioarduino exige Python ≥ 3.10; en local no compila). Sin hardware aún: el contrato + mock siguen vigentes y el siguiente real es el GPIO de relés.

## Detalles

### Contrato HTTP esperado (la placa lo cumple, el backend lo consume)

| Método + path | Acción física | Respuesta esperada |
|---|---|---|
| `POST /riego/on` | Activa relé de riego | 200 |
| `POST /riego/off` | Desactiva relé de riego | 200 |
| `POST /luces/on` | Activa relé de luces | 200 |
| `POST /luces/off` | Desactiva relé de luces | 200 |
| `GET /estado` | Reporta estado de relés | 200 + JSON de estado |
| `GET /health` | Liveness de la placa | 200 |

El backend mapea `POST /devices/:deviceId/actions { "action": "turn_on"|"turn_off", "target": "riego"|"luces" }` hacia el endpoint físico correspondiente (`/riego/on`, etc.). Si la placa no responde, el backend devuelve 502 con device ID + timestamp y guarda `ActionLog failed`. Sin reintentos agresivos.

```
Backend                          ESP32
POST /devices/:id/actions
{ action: turn_on, target: riego }
   └─► POST http://<ip>:<port>/riego/on ──► relé ON
   ◄─ 200 OK ───────────────────────────── estado
   └─► ActionLog { result: success }

Sin red:
   └─► timeout ──► HTTP 502 + ActionLog { result: failed }
```

### Decisión de toolchain: por qué PlatformIO + Arduino + C++

| Tema | Decisión |
|---|---|
| Lenguaje | C++ (idioma del firmware) |
| Entorno | PlatformIO en VS Code (construye, administra y carga) |
| Framework | Arduino Framework sobre IDF (vía fork `pioarduino`) |
| `platformio.ini` | Versionado en el repo desde el día 1, como `package.json` |
| Estructura | `hal/` (pines) / `net/` (WiFi/HTTP) / `api/` (rutas); puerta abierta a ESP-IDF sin rewrite |

#### El desafío: C++ es el idioma, no el entorno

Compilar C++ "directo" para ESP32-S3 significa resolver a mano toda esta cadena:

```
código.cpp ──► toolchain Xtensa ──► framework ESP32 ──► config de placa
  ──► compilación + enlazado ──► bootloader + particiones ──► flasheo USB
```

| Eslabón | Qué hay que resolver a mano | Por qué es frágil |
|---|---|---|
| Toolchain Xtensa | Descargar versión exacta, paths, flags de compilación | Cada máquina compila distinto; imposible reproducir |
| Framework ESP32 | Versión del core, IDF subyacente, defines de placa S3 | Un update silencioso rompe el build sin aviso |
| Librerías | Copiar carpetas, versiones sin pinear | Dos clones del repo usan dos librerías distintas |
| Placa + particiones | Modelo S3, flash size, `partitions.csv` OTA | Sin particiones correctas no hay OTA después |
| Flasheo USB | Velocidad, puerto, secuencia DOWNLOAD/RESET | Funciona en una PC y falla en otra |

Hacerlo manual funciona una vez y falla la siguiente. Sin entorno, no hay build reproducible ni CI posible.

#### Qué resuelve PlatformIO

PlatformIO concentra IDE + build + dependencias + flasheo + config de hardware en VS Code, todo versionado en Git.

| `platformio.ini` | `package.json` |
|---|---|
| `board`, `framework`, `platform` pinean el hardware | `engines`, dependencias pineadas |
| `lib_deps` instala librerías como `npm install` | `dependencies` con versiones fijas |
| `env:dev` / `env:prod` separan configuraciones | `scripts dev/build` por entorno |
| `pio run`, `pio run -t upload`, `monitor`, CI | `npm run build/test`, CI en GitHub Actions |

```ini
[env:esp32-s3-dev]
board = esp32-s3-devkitc-1
framework = arduino
lib_deps = bblanchon/ArduinoJson@^7.0.0
build_flags = -DARDUINO_USB_CDC_ON_BOOT=1
```

| Por qué encaja aquí | Por qué Arduino IDE no |
|---|---|
| Quien ya vive en VS Code + Git + backend/frontend estructurados no cambia de hábitos | Sin `platformio.ini`: config fuera del repo, no versionable |
| Multi-env, monitor, upload y CI desde el mismo archivo | Sin multi-env ni CI; un solo sketch a la vez |
| Librerías pineadas en `lib_deps`, reproducibles | Librerías copiadas a mano, sin versiones |
| Debug y flags por entorno | Debug solo con `Serial.print` |

#### Por qué el fork pioarduino y no el platform oficial

| Platform | Estado a mediados de 2026 | Consecuencia |
|---|---|---|
| `espressif32` oficial | Estancado en Arduino Core 2.x | Sin mejoras del Core 3.x ni IDF 5.x reciente |
| Fork comunitario `pioarduino` | Arduino Core 3.3.x sobre IDF 5.5, activo | Soporte S3 actual, bugfixes recientes, IDF moderno debajo |

| Riesgo honesto | Mitigación |
|---|---|
| Dependencia de un fork comunitario, no de Espressif | Pinear URL estable o versión en `platformio.ini`; `pio run` en CI detecta roturas |
| Overhead conocido: ~45-60 KB RAM vs ~30 KB de IDF puro | Costo aceptado para este firmware simple (relés + HTTP); se mide en el paso 1 del roadmap |

Arduino 3.x ya corre sobre IDF: la separación `hal/net/api` deja la puerta abierta a ESP-IDF nativo sin rewrite.

#### Comparativa completa para ESTE proyecto

| Herramienta | Lenguaje | Pros | Contras | Cuándo usarla aquí |
|---|---|---|---|---|
| Arduino IDE | C++ | Arranque rápido, ejemplos abundantes | Sin `platformio.ini`, sin multi-env/CI, libs manuales, debug solo Serial | Nunca como base del repo; solo prueba puntual |
| PlatformIO + Arduino (`pioarduino`) | C++ | Reproducible, `lib_deps`, multi-env, CI, VS Code | Fork comunitario, overhead RAM ~45-60 KB | Decisión actual: todo el firmware |
| ESP-IDF nativo | C | Control total: tasks con prioridades, OTA firmada con rollback, deep-sleep fino | Curva alta, más código para el mismo HTTP | Migrar cuando se necesiten esas tres cosas; `hal/net/api` lo permite |
| MicroPython | Python | Prototipado y docencia veloces | Lento en cómputo, pausas de GC, OTA/watchdog débiles | Prototipar un sensor; nunca producción |
| Rust `esp-hal` | Rust | Seguro, 1.0 estable | Toolchain fork + WiFi experimental | Reevaluar en 12 meses, no hoy |

Si C++ es el idioma del firmware, PlatformIO es el entorno que lo construye, administra y carga en la placa.

### Estrategia mock sin placa

| Capa | Sin hardware | Con hardware |
|---|---|---|
| Backend → placa | `InMemoryEsp32ClientService` (`DATA_SOURCE=in-memory`) | `Esp32HttpClientService` (`DATA_SOURCE=prisma`) |
| Contrato | Se define primero y no cambia sin acuerdo | La placa lo implementa tal cual |
| WiFi/red | No se necesita | WiFi robusto con credenciales en NVS (ver roadmap) |
| Pruebas e2e | Contra el mock | e2e NestJS → placa real (paso 11 del roadmap) |

### Roadmap en 11 pasos (orden intencional)

| # | Paso | Por qué en ese orden |
|---|---|---|
| 1 | Hello world + `partitions.csv` OTA | OTA desde el día 1: sin particiones correctas no hay actualización remota después |
| 2 | GPIO (un relé, un LED) | Valida el actuador mínimo antes de sumar red |
| 3 | WiFi robusto con NVS | Reconexión automática; credenciales fuera del código |
| 4 | `GET /health` + `GET /estado` PRIMERO | Observabilidad antes que acción: si no reporta estado, no se le ordena nada |
| 5 | `POST` de relés (`/riego`, `/luces`) | Recién aquí la placa ejecuta |
| 6 | Sensor (lectura básica) | Telemetría separada del control |
| 7 | Watchdog + fail-safe | Si el firmware se cuelga o pierde red, los relés quedan en estado seguro |
| 8 | OTA funcional | Actualizar sin USB una vez desplegado |
| 9 | MQTT | Solo después del HTTP estable; n8n sigue sin publicar directo a la placa |
| 10 | e2e NestJS → placa | El backend real contra el firmware real |
| 11 | Endurecimiento (auth básica, límites, logs) | Seguridad al final del camino funcional, antes de producción |

### Quirks del ESP32-S3 (anotar para no perder una tarde)

| Síntoma | Causa / solución |
|---|---|
| El puerto serie no aparece en VS Code | Definir `ARDUINO_USB_CDC_ON_BOOT=1` en la configuración |
| El primer flash falla o queda colgado | Poner la placa en modo DOWNLOAD + RESET manual; los flashes siguientes ya son normales |

## Checklist

- [ ] Puedo listar los 6 endpoints del contrato sin mirar la tabla
- [ ] Sé qué cambia entre `DATA_SOURCE=in-memory` y `DATA_SOURCE=prisma`
- [ ] Entiendo por qué `/health` y `/estado` van antes que los `POST`
- [ ] Sé por qué OTA y `partitions.csv` son el paso 1 y no un extra final
- [ ] Conozco los dos quirks del S3 antes de conectar la primera placa
- [ ] Puedo explicar por qué no compilar C++ directo (cadena Xtensa → framework → particiones → USB sin reproducibilidad)
- [ ] Sé por qué `pioarduino` y no el platform oficial, con su riesgo y mitigación
- [ ] Conozco el costo aceptado (~45-60 KB RAM) y cuándo migrar a ESP-IDF nativo

## Próximo paso

El scaffold `firmware/` ya está mergeado (PR #14: `platformio.ini` + estructura `hal/net/api` + `GET /health`, compila en CI). El PR #12 también está mergeado. Siguiente real: GPIO de relés (paso 2 del roadmap; sin placa se valida compilando). En paralelo, el swap del nodo MQTT en n8n (ver doc 03).

# El enlace push: la placa que llama al hub (y el crash que escondía HTTPClient)

La serie viene de 04: placa provisionada, `/estado` en vivo y la cadena backend→placa verificada con el poller **pull** (el backend consultaba la placa cada 30 s). Este documento cuenta la etapa siguiente —**invertir el enlace**, que la placa sincronice sola contra el hub— y la cacería de un crash del driver WiFi que ninguna lectura de código podía explicar. Es materia prima directa para el artículo.

## Quick path

1. Si vas directo al debugging: "El crash" tiene la cacería completa: síntoma, descartes y el bisecado que aisló a HTTPClient.
2. Si te interesa el diseño: "El enlace push" y el contrato completo en `docs/board-link-modes.md`.
3. Evidencia: PR #24 (backend) y PR #25 (firmware), commits `4e62259` (fix) + `ebbc072` (toolchain).

## Por qué invertir el enlace

El poller pull funcionaba, pero tenía techo: la latencia mínima era el intervalo (30 s), el backend pagaba una conexión entrante por ciclo, y la placa detrás de NAT nunca podía "avisar" nada (un evento local quedaba invisible hasta el próximo poll). El modo push invierte la dirección: **la placa abre la conexión y sincroniza estado + comandos en un solo POST**.

## El enlace push (PRs #24 y #25)

Diseño (contrato completo en `docs/board-link-modes.md`):

- `DEVICE_LINK_MODE=pull|push` (default pull): el backend mantiene ambos caminos; push es aditivo.
- `POST /board/sync` con rol `service`: la placa manda `mac` + estado (relés, sensores, RSSI, uptime, reset_reason) + acks pendientes, y recibe `commands[]` para su MAC.
- Identidad por **MAC**: la placa no manda deviceId — el backend resuelve el device por `mac`. Menos estado en NVS.
- Comandos encolados en `device_commands`; `202 queued` si el device está online, `502` si no (mismo contrato que la acción pull).
- **Acks en el sync siguiente**: la placa aplica el comando y encola el ack (`ok`/`httpStatus`); el backend cierra el comando y escribe el `ActionLog` final.
- Token `service` con TTL largo (`auth:issue-token --ttl`), grabado en NVS por la herramienta de provisioning (`hub/url` + `hub/token`) junto al WiFi.

En la placa, `hub_sync` corre desde el loop (single-threaded), con intervalo piso de 3 s y timeout HTTP de 4 s — todo dentro de la ventana del watchdog de 10 s.

### La cadena verificada en vivo

`POST /devices/:id/actions {turn_on, riego}` → `202` con `commandId` → la placa aplica (`[hub][hal] riego -> ON (GPIO4 LOW)`) → `/estado` refleja `"riego":"on"` → el sync siguiente manda el ack → `device_commands` queda `acked`. Verificado también el `turn_off`; ambos comandos terminaron `acked` en la base local.

## El crash: LoadProhibited en el driver WiFi

### Síntoma

Con el push activo, la placa empezó a morir cada 10–50 s:

```
Guru Meditation Error: Core 0 panic'ed (LoadProhibited). Exception was unhandled.
```

El backtrace, resuelto con `addr2line` contra el ELF exacto, caía siempre en el driver WiFi **cerrado** (libnet80211/libpp): `rcReachRetryLimit → lmacProcessShortRetryFail → lmacProcessCtsTimeout → ppTask` (y en otro arranque `ppCalTxAMPDULength → ppProcessTxQ → ppTask`). Nada de nuestro código en la pila: el driver procesaba una transmisión y moría con un puntero corrupto.

### Descartes (lo que NO era)

| Hipótesis | Prueba | Resultado |
|---|---|---|
| Power save del WiFi | `WiFi.setSleep(false)` | No |
| Stack del loop chico | `ARDUINO_LOOP_STACK_SIZE=16384` + medir high-water | No (uso real ~2.8 KB) |
| Core viejo | Plataforma 55.03.39 → 55.03.312 (core 3.3.9 → 3.3.12) | No lo arregló… pero volvió el crash **determinístico**: tras el primer sync, en cada boot |

### El bisect en hardware

Con repro determinístico, el método fue reemplazar el sync por variantes mínimas, flashear y observar:

| Variante | Ciclos observados | Resultado |
|---|---|---|
| TCP connect/close puro | 11 | Limpio |
| HTTP crudo mínimo (WiFiClient) | 11 | Limpio |
| Escrituras crudas de 400/1200 B | 13 | Limpio |
| HTTP/1.1 keep-alive + `setNoDelay` + multi-write | 13 | Limpio |
| **Flujo HTTPClient (el original)** | — | **Crash tras el primer POST, en cada boot** |

El disparador no era el tamaño del payload, ni la ráfaga de segmentos, ni el keep-alive: era **HTTPClient**. El sospechoso interno (manejo de conexión de la librería) queda como nota para upstream; para el proyecto, la salida fue reemplazarlo.

### El fix

Un cliente HTTP crudo mínimo en `hub_sync.h` (~60 líneas): un solo `write` del request (Nagle lo coalesce en un segmento), `Connection: close`, lectura hasta cierre con cap de 8 KB, parseo de la línea de estado. Menos dependencias, menos superficie, y verificado en hardware: **soak de 90 s sin un solo reset** (dos veces, incluido el artefacto final) más la cadena completa de comandos/acks.

Bonus de la cacería: en el medio, la placa quedó "atrapada en modo download" (`boot:0x0 DOWNLOAD`) y ningún reset por software la destrababa. Causa real: **el botón BOOT había quedado físicamente atascado** (IO0 en bajo); software no puede override eso. Se destrabó presionándolo. Dato para el artículo: antes de sospechar del tooling, sospechar del hardware.

## Lecciones (para el artículo)

1. **El repro determinístico vale oro**: el upgrade de core no arregló nada, pero convirtió un crash intermitente en "crashea tras el primer sync, siempre" — y con eso el bisect fue cuestión de rondas.
2. **Bisecar en hardware es reemplazar y flashear**: variantes mínimas (connect/close → HTTP crudo → writes grandes → noDelay) aislaron la librería culpable sin leer una línea del driver.
3. **Los falsos culpables se descartan con evidencia**: power save y stack eran hipótesis razonables; medirlas costó poco y evitó "fixes" a ciegas.
4. **Las cajas negras se reemplazan cuando hacen daño**: HTTPClient es cómodo, pero un POST chico a un endpoint fijo no justifica cargar con su crash. 60 líneas propias devolvieron control total del flujo.
5. **`addr2line` contra el ELF exacto, otra vez**: convirtió el panic en una cadena legible dentro del driver cerrado (y permitió afirmar "no es nuestro código" con datos).
6. **Hardware primero**: el "modo download atrapado" era un botón atascado, no el tooling.

## Pendientes al cierre (estado al 02/10/2026)

- Merge del PR #25 (CI: backend y frontend en verde; build de firmware en curso al escribir).
- Soak largo (horas) del push con relés y DHT22 cableados.
- Cableado del módulo de relés (GPIO4/5) y del DHT22 (GPIO15 + pull-up).
- Despliegue a Oracle Cloud Always Free (stack completo + migración de n8n; cazador de capacidad corriendo).
- Swap del nodo MQTT de n8n por HTTP `POST /devices/:id/actions`.

## Apéndice: comandos de la cacería

```bash
# Resolver backtrace contra el ELF flasheado
xtensa-esp32s3-elf-addr2line -pfiaC -e firmware/esp32/.pio/build/esp32-s3-devkitc-1/firmware.elf <addr>...

# Flashear (el upload deja la placa lista; reset por software con esp_pylib DTR=HIGH)
pio run -d firmware/esp32 -e esp32-s3-devkitc-1 -t upload -p /dev/cu.usbmodemXXXX

# Verificar acks en la base local
docker exec hah-postgres-local psql -U postgres -d home_automation_hub \
  -c "select status, created_at from device_commands order by created_at desc limit 4;"
```

# Modos de enlace con la placa: pull y push

El hub se comunica con la placa ESP32 de dos maneras. La elección depende de
dónde viva el backend respecto de la red de la placa:

| | `pull` (default) | `push` |
|---|---|---|
| Quién inicia el enlace | El backend llama a `GET /estado` y a los endpoints de comando | La placa llama a `POST /board/sync` |
| Requisito de red | El backend debe alcanzar `ip:port` de la placa | La placa debe alcanzar la URL del backend |
| Cuándo usarlo | Placa y hub en la misma LAN | El hub vive fuera de la LAN (p. ej. un VPS) |
| Estado y telemetría | Poller cada `DEVICE_POLL_INTERVAL_MS` | Reportados en cada sync + sweep de staleness |
| Comandos | HTTP directo, `ActionLog` inmediato | Cola `DeviceCommand`, `ActionLog` al recibir el ack |

Variable de selección:

```bash
DEVICE_LINK_MODE=pull   # default; comportamiento histórico
DEVICE_LINK_MODE=push   # la placa inicia el enlace
```

La variable se evalúa en cada request, pero los procesos de fondo (poller y
sweep) la leen al arrancar la app: un cambio de modo requiere reiniciar el
backend.

## Compatibilidad

- Con `pull` nada cambia: es el comportamiento histórico y el default.
- `push` requiere firmware que implemente `POST /board/sync` (contrato más
  abajo). En este modo el backend no abre conexiones hacia la placa y el
  poller de `src/monitoring` no corre.

## Variables de entorno

| Variable | Default | Modo | Efecto |
|---|---|---|---|
| `DEVICE_LINK_MODE` | `pull` | ambos | `pull` o `push`; cualquier otro valor cae a `pull` |
| `DEVICE_POLL_INTERVAL_MS` | `30000` | pull | Intervalo del poller de estado/telemetría; `<= 0` lo desactiva |
| `BOARD_SWEEP_INTERVAL_MS` | `30000` | push | Intervalo del sweep de staleness; `<= 0` lo desactiva |
| `ESP32_HTTP_TIMEOUT_MS` | `5000` | pull | Timeout de las llamadas backend → placa |

> En Docker Compose, cada variable debe estar reenviada al servicio
> `backend` (bloque `environment:`) para llegar al contenedor. Revisá el
> compose que uses antes de desplegar; el modo por defecto en la imagen es
> `pull`.

Umbrales fijos (todavía no configurables):

| Umbral | Valor | Qué hace |
|---|---|---|
| Offline | 30 s sin sync | `last_seen_at` viejo ⇒ device `offline`; una acción nueva responde 502 |
| Ack timeout | 120 s sin ack | comando `pending`/`dispatched` ⇒ `expired` + `ActionLog` failed (`ack timeout`) |

## Contrato de `POST /board/sync`

- Rol requerido: `service` (token dedicado, ver más abajo).
- Respuesta exitosa: `200 OK`.
- El backend identifica la placa por `mac` (case-insensitive) contra
  `Device.macAddress`. Si no existe: `404` con el recordatorio de registrarla
  con `--mac`.

Request:

```json
{
  "mac": "C0:4E:30:07:DE:10",
  "fw": "0.5.0",
  "uptime_s": 1234,
  "rssi_dbm": -42,
  "reset_reason": "POWERON",
  "relays": { "riego": "off", "luces": "off" },
  "sensors": { "temperature_c": null, "humidity_pct": null, "valid": false, "age_s": null },
  "acks": [{ "id": "uuid", "ok": true, "httpStatus": 200 }]
}
```

Response:

```json
{
  "deviceId": "uuid",
  "commands": [{ "id": "uuid", "action": "turn_on", "target": "riego" }]
}
```

Comportamiento del backend en cada sync:

1. Marca el device `online` y actualiza `last_seen_at`.
2. Procesa `acks[]`: el comando pasa a `acked` con `result` `success`/`failed`
   y se escribe el `ActionLog` final (una sola fila por comando; los acks
   duplicados y los de comandos de otro device se ignoran).
3. Si `sensors.valid = true`, ingesta el snapshot DHT22 como telemetría con
   el mismo mapeo que el poller: `temperature/celsius/dht22` y
   `humidity/percent/dht22`.
4. Devuelve hasta 20 comandos `pending` del device (los más viejos primero) y
   los pasa a `dispatched` con `dispatched_at`.

Errores esperables:

| Código | Cuándo |
|---|---|
| 400 | JSON inválido (MAC mal formada, tipos incorrectos, campos desconocidos) |
| 401 | Sin token o token vencido |
| 403 | Token sin rol `service` |
| 404 | MAC no registrada |

## Registro de la placa con `--mac`

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/home_automation_hub \
  npm run devices:register -- \
  --name "riego-patio" --ip 192.168.1.50 --port 80 \
  --mac "C0:4E:30:07:DE:10"
```

- `--mac` es opcional y se normaliza a mayúsculas (`AA:BB:CC:DD:EE:FF`),
  aceptando separadores `:` o `-`.
- Sigue siendo un upsert por `--name`: re-ejecutarlo re-apunta la misma placa.
- En modo push lo que importa es la MAC; la IP puede quedar desactualizada o
  directamente no existir si la placa no tiene dirección fija.

## Token de la placa y de n8n

```bash
# 30 días
npm run auth:issue-token -- --role service --sub board-patio --days 30

# u otra ventana en notación jsonwebtoken
npm run auth:issue-token -- --role service --sub n8n-sistema-riego --ttl 720h
```

- Default: 24 h cuando no se especifica ventana.
- `--ttl` acepta `30s`, `45m`, `72h`, `30d`; `--days <n>` equivale a `<n>d`.
- `--ttl` y `--days` son mutuamente excluyentes.
- El firmware guarda el token y lo manda como `Authorization: Bearer ...` en
  cada `POST /board/sync`.

## Ciclo completo en push

```
n8n  → POST /devices/:id/actions (service)
        └─ 202 { result: "queued", commandId }
placa → POST /board/sync                  → recibe el comando (dispatched)
placa → POST /board/sync (con ack)        → ActionLog final
```

Si la placa lleva más de 30 s sin sincronizar, la acción responde `502` y el
`ActionLog` queda `failed` con `device offline (last seen Xs ago)`: el mismo
contrato que en `pull`, para que n8n no necesite cambios.

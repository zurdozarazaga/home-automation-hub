# n8n integration

Esta doc cubre el detalle operativo de la integración entre los workflows
n8n y el backend de este repo. La regla arquitectónica de alto nivel vive en
[`../AGENTS.md`](../AGENTS.md) — leerla primero.

---

## Instancia

- **URL:** https://n8n.opi.ar/
- **Workflow activo:** `sistema_riego_automatizado`
- **ID:** `heJzDDe5HCCz7Xuy`
- **Zona horaria:** `America/Argentina/Buenos_Aires` (UTC-3)
- **Otros workflows en la misma instancia:** ver `~/.config/Code/User/mcp.json`
  para la lista completa.

Los JSON locales en `/home/ezarazaga/n8n/smart-irrigation-telegram-mqtt.json`
y carpetas análogas son **backups/templates**, no fuente de verdad. No
editarlos esperando que se reflejen en `n8n.opi.ar`.

---

## Flujo actual del workflow (verificado 2026-10-10 vía MCP)

```
Schedule 06:00 (Daily Morning Check) ─┬─→ Merge Triggers ─┬─→ Route Scheduled (sin contenido)
Webhook POST (Chatwoot/Telegram) ─────┘                   │    └─→ Define Zones (Front Garden, Vegetable Patch)
                                                          │         ├─→ OpenWeatherMap (current, Río Cuarto)
                                                          │         └─→ OpenWeatherMap (5-day forecast)
                                                          │              └─→ Merge Weather
                                                          │                   └─→ Irrigation Logic (shouldWater / duration / reason)
                                                          │                        └─→ Needs Watering? (filter shouldWater)
                                                          │                             └─→ Execute Backend Action ─→ POST backend /devices/:deviceId/actions
                                                          │                                                           (riego físico, auditado en ActionLog)
                                                          │
                                                          └─→ Route Commands (mensajes Chatwoot entrantes)
                                                               └─→ Command Logic (encender/detener/estado)
                                                                    └─→ Format Chatwoot Response
                                                                         └─→ Send to Chatwoot (POST crm.opi.ar, solo chat, sin acción física)
```

Notas:

- **Chatwoot es el puente a Telegram**: no hay trigger de Telegram directo;
  los mensajes de Telegram llegan como webhook de Chatwoot y se responden
  por la misma vía. La rama de comandos hoy solo conversa (el "✅ riego
  ENCENDIDO" es un mensaje de chat, no acciona la placa).
- **Ya no hay nodo MQTT.** La ejecución física pasa por el nodo
  `Execute Backend Action` (HTTP Request con credencial Header Auth
  `HUB Service JWT`, rol `service`).
- La salida `false` de `Needs Watering?` queda vacía a propósito (sin riego).

**Wiring de test local (fase actual):**

- Backend público (túnel estable, fase de pruebas):
  `https://backend.yct4yaoyv6nl.opentunnel.xyz`
- Device: `riego-patio` (`ad91c47f-70a0-4437-819f-7620f9926451`)
- Nodo: `POST /devices/:deviceId/actions` con
  `{ "action": "turn_on", "target": "riego" }`
- Verificación end-to-end 2026-10-10: ejecución manual con decisión
  simulada (`shouldWater: true`) → `ActionLog success` + placa en `riego:on`.
  Al migrar al VPS, actualizar la URL base del nodo (el contrato no cambia).

---

## Modificar el workflow (vía MCP)

El agente (opencode) accede a la instancia con el servidor MCP remoto
`n8n-mcp` (`https://n8n.opi.ar/mcp-server/http`, API key en
`~/.config/opencode/opencode.json`, fuera del repo). Nunca commitear ese
token; rotarlo en n8n al terminar la fase de pruebas.

Nunca editar `n8n.opi.ar` a mano salvo excepción explícita y puntual
(2026-10-10: el nodo `Execute Backend Action` se creó en la UI porque el
`update_workflow` del MCP exige reescribir los 14 nodos y no expone los
nombres de las credenciales existentes de OpenWeatherMap/Chatwoot).
Usar las tools MCP de n8n:

1. **Listar workflows:** `mcp_n8n-mcp_n8n_list_workflows`
2. **Obtener workflow completo:** `mcp_n8n-mcp_n8n_get_workflow` con
   `mode: "full"` y `id: "heJzDDe5HCCz7Xuy"`
3. **Modificar parcialmente:** `mcp_n8n-mcp_n8n_update_partial_workflow`
4. **Validar antes de activar:** `mcp_n8n-mcp_n8n_validate_workflow`
5. **Activar:** `mcp_n8n-mcp_n8n_activate_workflow`

Checklist antes de activar un cambio:

- [ ] Conexiones entre nodos completas (sin flechas huérfanas)
- [ ] Campos requeridos del nodo HTTP Request completos
- [ ] URL del backend correcta (túnel de pruebas u hostname del VPS;
      `http://backend:3001` solo vale dentro de la red Docker local)
- [ ] Header `Authorization: Bearer <JWT>` presente (vía credencial
      Header Auth, nunca hardcodeado en el nodo)
- [ ] Body con `action` y `target` válidos según el DTO del backend
- [ ] Manejo del 502: no reintentar en loop

---

## Auth: rol `service`

n8n llama al backend con un JWT de cuenta de servicio, no de usuario humano.
El rol se llama `service` (no `admin`) para:

- Limitar blast radius si el token se filtra (solo `POST /devices/:id/actions`).
- Dejar rastro claro en los logs: el `sub` del JWT es `n8n-sistema-riego`,
  no un email de admin.
- Permitir revocación independiente del resto de usuarios.

**Estado actual:** el rol `service` existe
(`backend/src/auth/interfaces/role.interface.ts`) y los guards globales lo
exigen en `POST /devices/:deviceId/actions` (`admin`, `service`) y en
`POST /integrations/n8n/actions` (`service` exclusivo).

## Service token: issuance and rotation

- **Issue:** `JWT_SECRET=<secret> npm run auth:issue-service -- <sub>`
  (from `backend/`; `<sub>` defaults to `n8n-sistema-riego`). TTL 24h.
- **Issue (fase de pruebas):** `npm run auth:issue-token -- --role service --days 30`
  para no rotar a diario mientras el backend vive en la Mac.
- **Store:** save the token as the n8n HTTP Header Auth credential
  (`Authorization: Bearer <JWT`). Never commit tokens to the repo.
- **Rotate (leak suspected):** re-issue, update the n8n credential, confirm
  a dispatch succeeds. Calls with the old token fail once it expires.
- **Full invalidation:** rotate `JWT_SECRET` (root `.env`, `backend/.env`,
  CI env) and re-issue all service tokens. All previously issued tokens
  stop verifying immediately.
- **Expiry symptom:** backend responds 401. Re-issue and update the n8n
  credential — do not retry in a loop.

---

## Backend: endpoints que n8n invoca

### `POST /devices/:deviceId/actions`

- **Body:**
  ```json
  { "action": "turn_on", "target": "riego" }
  ```
- **Response 201/200:**
  ```json
  {
    "deviceId": "uuid",
    "action": "turn_on",
    "target": "riego",
    "endpoint": "/riego/on",
    "result": "success",
    "httpStatusCode": 200,
    "executedAt": "2026-06-06T12:00:00.000Z"
  }
  ```
- **Response 502:** ESP32 caído. `ActionLog` queda con `result: "failed"`,
  `httpStatusCode: 502`, `errorMessage` poblado.
- **Auth:** JWT con rol `service`.

### `GET /devices`

- Útil para que n8n resuelva `deviceId` por nombre si en el futuro el
  workflow necesita decidir a qué dispositivo mandar el comando.

---

## Troubleshooting

### n8n dice "ECONNREFUSED backend:3001"

El workflow corre en `n8n.opi.ar` (remoto), no en Docker local. La URL
correcta es `http://<host-externo>:3001`, no `http://backend:3001`.
Confirmar la URL con quien levantó la instancia.

### Backend responde 401

- El JWT expiró. Rotar y actualizar la credencial en n8n.
- El rol no es `admin` ni `service`. Verificar el payload del JWT.

### `GET /devices` con token `service` da 403 (esperado)

Por diseño (`devices.controller.ts`, solo `admin`/`viewer`). El rol
`service` es solo-acciones: n8n debe usar el `deviceId` conocido, no
listar dispositivos.

### `test_workflow` reporta timeout pero la ejecución fue success

El MCP puede cortar el llamado a los 300 s aunque el workflow haya
terminado bien. Verificar siempre con `get_execution` (workflowId +
executionId) y con el `ActionLog` local antes de declarar un fallo.

### Backend responde 502

- ESP32 caído. `ActionLog` tiene el detalle. No reintentar agresivamente:
  si el ESP32 está sin red, bombardear con POSTs solo satura el log y
  el backend. Un reintento a los 5 min es razonable.

### Backend responde 404

- `deviceId` no existe o el ESP32 detrás de ese ID nunca se registró.
  Verificar `GET /devices` y el log de registro.

### Webhook abierto sin auth (pendiente endurecer)

El trigger Webhook no exige credenciales y un POST con body vacío cae en
la rama programada (`Route Scheduled`), disparando una evaluación de
riego. No explotado hasta ahora; antes del VPS, agregar auth al webhook
o filtrar origen.

---

## Ver ejecuciones en la UI

1. Ir a https://n8n.opi.ar
2. Abrir el workflow `sistema_riego_automatizado`
3. Pestaña **Executions** (arriba a la derecha)
4. Click en una ejecución → ver input/output JSON nodo por nodo
5. Verde ✅ = éxito, rojo ❌ = error (mensaje en el nodo que falló)

---

## Referencias

- Regla arquitectónica: [`../AGENTS.md`](../AGENTS.md) § n8n integration
- Backend `ActionsService`: `backend/src/actions/actions.service.ts`
- Backend `ActionsController`: `backend/src/actions/actions.controller.ts`
- ESP32 client: `backend/src/actions/services/esp32-http-client.service.ts`
- Roles (`admin`, `viewer`, `service`):
  `backend/src/auth/interfaces/role.interface.ts`
- Guards (`JwtAuthGuard` 401 + `RolesGuard` 403):
  `backend/src/auth/guards/`

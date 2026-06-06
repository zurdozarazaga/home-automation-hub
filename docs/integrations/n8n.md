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

## Flujo actual del workflow

```
Schedule 06:00 (Daily Morning Check)
Webhook manual (path: irrigation-manual)
Telegram trigger
  └─→ Merge Triggers
       └─→ Define Zones (Front Garden, Vegetable Patch, lat/lon)
            ├─→ OpenWeatherMap (current)
            └─→ OpenWeatherMap (5-day forecast)
                 └─→ Merge Weather
                      └─→ Irrigation Logic (shouldWater / duration / reason)
                           └─→ Filter: Needs Watering?
                                ├─→ MQTT publish a "casa/jardin/riego/comandos"  ← REMOVER
                                └─→ Telegram notification
```

**Estado objetivo** (lo que la integración debe terminar siendo):

```
Schedule 06:00
Webhook manual
Telegram trigger
  └─→ Merge Triggers
       └─→ Irrigation Logic (decide)
            └─→ HTTP Request → POST http://backend:3001/devices/:deviceId/actions
                 body: { "action": "turn_on"|"turn_off", "target": "riego"|"luces" }
                 headers: Authorization: Bearer <JWT service>
                 └─→ Si 200/201: Telegram notification (éxito)
                     Si 502:      Telegram notification (ESP32 caído, sin reintento agresivo)
```

El nodo MQTT se reemplaza por un HTTP Request. La decisión (clima, horario,
trigger manual) sigue siendo de n8n. La ejecución física y la auditoría
pasan al backend.

---

## Modificar el workflow (vía MCP)

Nunca editar `n8n.opi.ar` a mano. Usar las tools MCP de n8n:

1. **Listar workflows:** `mcp_n8n-mcp_n8n_list_workflows`
2. **Obtener workflow completo:** `mcp_n8n-mcp_n8n_get_workflow` con
   `mode: "full"` y `id: "heJzDDe5HCCz7Xuy"`
3. **Modificar parcialmente:** `mcp_n8n-mcp_n8n_update_partial_workflow`
4. **Validar antes de activar:** `mcp_n8n-mcp_n8n_validate_workflow`
5. **Activar:** `mcp_n8n-mcp_n8n_activate_workflow`

Checklist antes de activar un cambio:

- [ ] Conexiones entre nodos completas (sin flechas huérfanas)
- [ ] Campos requeridos del nodo HTTP Request completos
- [ ] URL del backend correcta (`http://backend:3001` dentro de la red
      Docker, `http://localhost:3001` si n8n corre fuera)
- [ ] Header `Authorization: Bearer <JWT>` presente
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

**Estado actual:** el `RolesGuard` en
`backend/src/auth/guards/roles.guard.ts` solo conoce `admin` y `viewer`. El
rol `service` es un TODO conocido. Hasta que exista:

- Opción A (temporal): emitir un JWT con `role: "admin"` y guardarlo como
  secret de n8n. **No recomendado** para producción.
- Opción B (correcta): agregar `service` al enum de roles, crear un
  usuario dedicado en la tabla correspondiente, rotar el JWT.

Pendiente: rotar el JWT y guardarlo en las credenciales de n8n
(`n8n-nodes-base.httpRequest` auth type `genericCredentialType: "httpHeaderAuth"`).

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
- **Auth:** JWT con rol `service` (o `admin` mientras no exista `service`).

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

### Backend responde 502

- ESP32 caído. `ActionLog` tiene el detalle. No reintentar agresivamente:
  si el ESP32 está sin red, bombardear con POSTs solo satura el log y
  el backend. Un reintento a los 5 min es razonable.

### Backend responde 404

- `deviceId` no existe o el ESP32 detrás de ese ID nunca se registró.
  Verificar `GET /devices` y el log de registro.

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
- RolesGuard (pendiente extender con `service`):
  `backend/src/auth/guards/roles.guard.ts`

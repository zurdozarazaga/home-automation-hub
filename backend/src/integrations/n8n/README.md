# N8nModule

Adapter que recibe llamadas del workflow n8n `sistema_riego_automatizado`
y las delega al `ActionsService` del backend, que a su vez orquesta el ESP32
y registra el `ActionLog`.

## Estado actual: esqueleto

El controller existe para fijar la ruta (`POST /integrations/n8n/actions`)
y dejar claro el contrato, pero **no implementa lógica** todavía. Devuelve
`501 Not Implemented`. El motivo es que depende de tres prerrequisitos
del módulo de auth que aún no están resueltos:

1. El rol `service` no existe en `Role` (hoy solo `admin` y `viewer`).
2. `RolesGuard` aún no extrae roles del JWT (tiene un TODO).
3. No hay flujo para emitir/rotar el JWT de la cuenta de servicio.

Hasta que esos tres puntos estén cerrados, **no exponer este endpoint a
tráfico real**: el controller no tiene auth aplicada.

## Trabajo pendiente

- [ ] Agregar `'service'` a `backend/src/auth/interfaces/role.interface.ts`
- [ ] Reemplazar el `return true` placeholder en `roles.guard.ts` por la
      lectura real del rol desde `request.user`
- [ ] Emitir un JWT dedicado (`sub: 'n8n-sistema-riego'`, `role: 'service'`)
      y guardarlo como credencial HTTP Header Auth en n8n.opi.ar
- [ ] Implementar `N8nService.dispatch(deviceId, dto)` que llame a
      `ActionsService.execute`
- [ ] Aplicar `@Roles('service')` + `UseGuards(RolesGuard, AuthGuard)` al
      controller y cambiar `@HttpCode(501)` por el código real (200/201)
- [ ] Escribir un e2e test que mockee el ESP32 y verifique el log

## Referencias

- Regla arquitectónica y endpoint destino: [`../../../AGENTS.md`](../../../AGENTS.md)
- Detalle operativo: [`../../../docs/integrations/n8n.md`](../../../docs/integrations/n8n.md)
- `ActionsService`: `../../actions/actions.service.ts`

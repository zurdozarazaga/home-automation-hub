# Desafíos reales y cómo se resolvieron sin romper lo que anda

Cada decisión difícil del proyecto en una tabla: qué dolía, por qué pasaba, qué se hizo y dónde está la evidencia. Si vienes de afuera, esta es la historia que los commits solos no cuentan.

## Quick path

1. Lee la tabla completa una vez: son 6 desafíos, cada uno con causa y resolución.
2. Si quieres entender el PR #12 (ya mergeado), enfócate en la fila de presupuesto de revisión: explica por qué fue un PR único de ~800 líneas.
3. Si vas a tocar n8n o firmware, lee esas dos filas con detalle: tienen trabajo pendiente explícito.

## Detalles

| Desafío | Causa | Resolución | Evidencia |
|---|---|---|---|
| Endpoints sin auth: cualquiera podía disparar acciones | El backend exponía rutas sin guards globales; cada controller decidía por su cuenta | Cambio `auth-hardening`: `JwtAuthGuard` (401) + `RolesGuard` (403) globales, rol `service` para n8n, CLI offline de emisión con TTL 24h | `feat/auth-hardening` (6 commits), PR #12 mergeado a `develop`; guards en `backend/src/auth/guards/`, rol en `backend/src/auth/interfaces/role.interface.ts` |
| Workflow n8n publicando MQTT directo a la placa | El workflow `sistema_riego_automatizado` decidía Y ejecutaba (nodo MQTT a `casa/jardin/riego/comandos`), salteando auth y auditoría | Regla arquitectónica trigger-source: n8n decide, el backend ejecuta y audita. El nodo MQTT se reemplaza por HTTP `POST /devices/:id/actions` con JWT `service` | `docs/integrations/n8n.md` (flujo actual vs. estado objetivo); regla en `AGENTS.md` § n8n integration; swap del nodo pendiente en el cambio `n8n-e2e` |
| Build rojo y e2e con 502 confundiendo el verify | Fallos preexistentes en `develop` (build + e2e 502) que parecían causados por el cambio en revisión | Prueba por stash contra `develop` limpio para aislar preexistentes; fixes preexistentes (prisma/502) fuera del diff funcional, como cambios separados | Trail del cambio `auth-hardening` (verify con stash); fixes preexistentes fuera del diff funcional |
| PR de ~800 líneas vs. presupuesto de 400 | 15 tareas de auth en un solo cambio (guards, rol, CLI, wiring): fraccionarlo atrasaba la ventana de revisión | Excepción de tamaño aprobada por el maintainer; PR único bien señalizado en lugar de cadena artificial | PR #12 (mergeado): 665 adiciones + 133 eliminaciones frente a presupuesto de 400 líneas |
| Sin hardware (scaffold ya mergeado) | ESP32-S3 planificado pero sin placa física; scaffold inicial mergeado (PR #14) | Estrategia mock + contrato primero + scaffold con `platformio.ini` y `hal/net/api`; compila en CI (pioarduino exige Python ≥ 3.10) | Doc `02-integrando-el-esp32.md`; `ActionsModule` con switch `in-memory`/`prisma`; `firmware/` en `develop` |
| Trail de diseño mezclado con commits de código | Riesgo de contaminar el PR funcional con historial de diseño | Práctica `chore`: el trail de cambios vive separado de los commits de código; el PR funcional solo lleva código | `openspec/changes/archive/2026-09-13-auth-hardening/` archivado; `feat/auth-hardening` con 6 commits convencionales limpios |

### Lo preexistente, separado de lo nuevo

| Tipo | Ejemplo | Cómo se trató |
|---|---|---|
| Preexistente | Build rojo + e2e 502 en `develop` | Se demostró con stash que ya existían; no se mezclaron en el diff de auth |
| Nuevo | Guards globales, rol `service`, CLI offline | Quedó dentro del PR #12 mergeado, revisable como unidad |

### Presupuesto de revisión: por qué un PR único

| Opción | Costo | Decisión |
|---|---|---|
| Fraccionar en N PRs encadenados | Ventana de revisión más larga, riesgo de estados intermedios sin auth coherente | Descartada |
| PR único con excepción de tamaño | ~800 líneas en una revisión, pero cambio completo y testeable | Aprobada por el maintainer |

Gitflow que protege la revisión: rama desde `develop`, PR hacia `develop`, commits convencionales, CI en verde, mergea el humano. Regla vigente: docs en rama propia hacia `develop`; `n8n.opi.ar` sin ediciones manuales.

## Checklist

- [ ] Puedo explicar por qué n8n nunca publica directo a la placa
- [ ] Sé qué demuestra la prueba por stash y cuándo usarla
- [ ] Entiendo por qué el PR #12 fue excepción de tamaño y quién la aprobó
- [ ] Distingo trabajo pendiente real (GPIO real, swap MQTT en `n8n-e2e`, decisión de despliegue) de trabajo terminado (auth y scaffold `firmware/` mergeados)

## Próximo paso

El PR #12 (auth) y el scaffold `firmware/` (PR #14) ya están mergeados a `develop`. En orden: GPIO real de relés, swap del nodo MQTT por HTTP en el cambio `n8n-e2e` (con `validate_workflow` antes de activar, sin ediciones manuales en `n8n.opi.ar`), y la decisión pendiente de despliegue de frontend/backend. Los fallos preexistentes de prisma/502 van como cambios separados.

# Desafíos reales y cómo se resolvieron sin romper lo que anda

Cada decisión difícil del proyecto en una tabla: qué dolía, por qué pasaba, qué se hizo y dónde está la evidencia. Si vienes de afuera, esta es la historia que los commits solos no cuentan.

## Quick path

1. Lee la tabla completa una vez: son 6 desafíos, cada uno con causa y resolución.
2. Si vas a revisar el PR #12, enfócate en la fila de presupuesto de revisión: explica por qué es un PR único de 800 líneas.
3. Si vas a tocar n8n o firmware, lee esas dos filas con detalle: tienen trabajo pendiente explícito.

## Detalles

| Desafío | Causa | Resolución | Evidencia |
|---|---|---|---|
| Endpoints sin auth: cualquiera podía disparar acciones | El backend exponía rutas sin guards globales; cada controller decidía por su cuenta | Cambio `auth-hardening`: `JwtAuthGuard` (401) + `RolesGuard` (403) globales, rol `service` para n8n, CLI offline de emisión con TTL 24h | `feat/auth-hardening` (6 commits), PR #12 abierto → `develop`; guards en `backend/src/auth/guards/`, rol en `backend/src/auth/interfaces/role.interface.ts` |
| Workflow n8n publicando MQTT directo a la placa | El workflow `sistema_riego_automatizado` decidía Y ejecutaba (nodo MQTT a `casa/jardin/riego/comandos`), salteando auth y auditoría | Regla arquitectónica trigger-source: n8n decide, el backend ejecuta y audita. El nodo MQTT se reemplaza por HTTP `POST /devices/:id/actions` con JWT `service` | `docs/integrations/n8n.md` (flujo actual vs. estado objetivo); regla en `AGENTS.md` § n8n integration; swap del nodo pendiente en el cambio `n8n-e2e` |
| Build rojo y e2e con 502 confundiendo el verify | Fallos preexistentes en `develop` (build + e2e 502) que parecían causados por el cambio en revisión | Prueba por stash contra `develop` limpio para aislar preexistentes; cambios de fix separados del cambio funcional | Trail del cambio `auth-hardening` (verify con stash); fixes preexistentes fuera del diff funcional |
| PR de ~800 líneas vs. presupuesto de 400 | 15 tareas de auth en un solo cambio (guards, rol, CLI, wiring): fraccionarlo atrasaba la ventana de revisión | `size:exception` aprobada por el maintainer, PR único bien señalizado en lugar de cadena artificial | PR #12: 665 adiciones + 133 eliminaciones; label `size:exception`; presupuesto documentado de 400 líneas |
| Sin hardware y sin `firmware/` | ESP32-S3 planificado pero sin placa física; nada que flashear | Estrategia mock + contrato primero: `InMemoryEsp32ClientService` con `DATA_SOURCE=in-memory`, contrato HTTP fijo, roadmap de 11 pasos con OTA desde el día 1 | Doc `02-integrando-el-esp32.md`; `ActionsModule` con switch `in-memory`/`prisma` |
| Trail de diseño mezclado con commits de código | Riesgo de contaminar el PR funcional con historial de diseño | Práctica `chore`: el trail de cambios vive separado de los commits de código; el PR funcional solo lleva código | `openspec/changes/archive/2026-09-13-auth-hardening/` archivado; `feat/auth-hardening` con 6 commits convencionales limpios |

### Lo preexistente, separado de lo nuevo

| Tipo | Ejemplo | Cómo se trató |
|---|---|---|
| Preexistente | Build rojo + e2e 502 en `develop` | Se demostró con stash que ya existían; no se mezclaron en el diff de auth |
| Nuevo | Guards globales, rol `service`, CLI offline | Todo dentro del PR #12, revisable como unidad |

### Presupuesto de revisión: por qué un PR único

| Opción | Costo | Decisión |
|---|---|---|
| Fraccionar en N PRs encadenados | Ventana de revisión más larga, riesgo de estados intermedios sin auth coherente | Descartada |
| PR único con `size:exception` | 800 líneas en una revisión, pero cambio completo y testeable | Aprobada por el maintainer |

Gitflow que protege la revisión: rama desde `develop`, PR hacia `develop`, commits convencionales, CI en verde, mergea el humano. Estamos en `feat/auth-hardening` con el PR #12 abierto: no se commitea ni se cambia de rama para trabajo de docs.

## Checklist

- [ ] Puedo explicar por qué n8n nunca publica directo a la placa
- [ ] Sé qué demuestra la prueba por stash y cuándo usarla
- [ ] Entiendo por qué el PR #12 es excepción de tamaño y quién la aprobó
- [ ] Distingo trabajo pendiente real (swap MQTT en `n8n-e2e`, scaffold `firmware/`, decisión de despliegue) de trabajo terminado

## Próximo paso

Lo inmediato es cerrar el PR #12 (`feat/auth-hardening` → `develop`) con CI en verde y merge del humano. Después, en orden: swap del nodo MQTT por HTTP en el cambio `n8n-e2e` (con `validate_workflow` antes de activar), scaffold `firmware/` con `GET /health` primero, y la decisión pendiente de despliegue de frontend/backend.

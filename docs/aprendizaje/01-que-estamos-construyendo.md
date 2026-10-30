# Qué estamos construyendo: una plataforma para controlar riego y luces sin acoplar hardware y software

Plataforma centralizada de domótica que controla riego y luces desde un solo backend auditable. Si entras hoy al proyecto, con este documento entiendes qué hace, cómo se conectan las piezas y qué reglas no se negocian.

## Quick path

1. Levanta todo en Docker: `docker compose -f docker-compose.local.yml up` (frontend `http://localhost:3000`, backend `http://localhost:3001`, Postgres `localhost:5432`).
2. Ejecuta una acción: `POST /devices/:deviceId/actions` con `{ "action": "turn_on", "target": "riego" }` y JWT con rol `admin` o `service`.
3. Verifica la auditoría: cada ejecución deja un `ActionLog` con `result: success | failed`, incluso cuando el ESP32 está caído (502).

## Detalles

### Las tres patas y sus responsabilidades

| Pieza | Puerto | Responsabilidad | Lo que NO hace |
|---|---|---|---|
| Frontend Next.js | 3000 | Interfaz de operación (ver dispositivos, disparar acciones) | Nunca llama al ESP32 directamente |
| Backend NestJS | 3001 | Decide, ejecuta y audita cada acción | Nunca delega lógica de negocio a la placa |
| ESP32 ejecutor físico | — | Enciende/apaga, reporta estado | Ninguna regla de negocio (sin horarios, sin clima, sin decisiones) |
| Postgres | 5432 | Persiste `Device`, `Relay`, `ActionLog` | Nada fuera del modelo Prisma |
| n8n (trigger source) | externo | Decide cuándo regar (clima, schedule, Telegram) | Nunca publica directo a MQTT/ESP32 |

### Arquitectura en un diagrama

```
                   ┌──────────────┐
                   │   n8n.opi.ar │  (decide: clima / schedule / Telegram)
                   │ trigger only │
                   └──────┬───────┘
                          │ POST /devices/:id/actions + JWT rol service
                          ▼
┌──────────┐      ┌──────────────┐      ┌──────────────┐
│ Frontend │ ───► │ Backend      │ ───► │ ESP32        │
│ Next.js  │ HTTP │ NestJS :3001 │ HTTP │ ejecutor     │
│ :3000    │      │ + ActionLog  │      │ físico       │
└──────────┘      └──────┬───────┘      └──────────────┘
                         │ Prisma
                         ▼
                  ┌──────────────┐
                  │ Postgres     │
                  │ :5432        │
                  └──────────────┘

Regla de flujo: Frontend → Backend → ESP32. n8n → Backend → ESP32.
No existe flecha Frontend → ESP32 ni n8n → ESP32.
```

### Reglas que sostienen el diseño

| Regla (AGENTS.md) | Qué significa en la práctica |
|---|---|
| Sin lógica de negocio en el ESP32 | La placa expone `on/off` y `/estado`. Si hay que decidir por clima u horario, vive en n8n o en el backend, no en C++ |
| Frontend jamás llama al ESP32 | Todo comando pasa por el backend para autenticar, autorizar y auditar |
| Controladores delgados | El controller valida el DTO; el service decide; el repository persiste. Prisma solo vive en repositorios |
| Prisma con try/catch → HttpException | Ningún error crudo de Prisma llega al controller. Se loguea con contexto y se traduce a HTTP |
| ESP32 inalcanzable = HTTP 502 | `BadGatewayException` con device ID + timestamp. Se registra `ActionLog failed`. Nunca se silencia |
| Prioridad: Seguridad > Arquitectura > resto | Un atajo de velocidad no justifica saltar auth ni acoplar capas |

### Datos: lo mínimo para auditar

| Modelo | Clave | Particularidad |
|---|---|---|
| `Device` | UUID | `name` único; par `(ipAddress, port)` único |
| `Relay` | UUID | Cascada al borrar su `Device` |
| `ActionLog` | UUID | Guarda cada intento: `success` o `failed` + `httpStatusCode` + `errorMessage` |

Columnas en `snake_case` vía `@map`. UUID en todos los PK.

### Dos modos de ejecución

| `DATA_SOURCE` | Cuándo usarlo | Qué cambia |
|---|---|---|
| `in-memory` (default) | Desarrollar sin DB ni placa | Repositorios fake + `InMemoryEsp32ClientService` |
| `prisma` | Integración real | Postgres real + `Esp32HttpClientService` (HTTP a la placa) |

El cambio se resuelve al arrancar (`DevicesModule`, `ActionsModule`). `DatabaseModule` es `@Global()`: `PrismaService` disponible sin reimportar.

### De dónde venimos (recorrido hasta hoy)

| Hito | Estado |
|---|---|
| `iiot-extensibility-seams` (seams driver/telemetría/transporte, PRs #6-8) | Archivado y mergeado |
| `auth-hardening` (guards globales 401/403, rol `service`, CLI offline TTL 24h, 15 tareas, 6 commits) | Archivado y mergeado a `develop` (PR #12) |
| Firmware ESP32-S3 | Scaffold inicial mergeado (PR #14, compila en CI); sin hardware aún, estrategia mock + contrato primero (ver doc 02) |
| Despliegue frontend/backend | Pendiente de decisión |

Gitflow vigente: rama desde `develop`, PR hacia `develop`, commits convencionales, CI en verde, mergea el humano.

## Checklist

- [ ] Puedo explicar el flujo completo sin mencionar MQTT entre n8n y la placa
- [ ] Sé por qué un 502 del backend significa "ESP32 caído" y dónde buscar el detalle (`ActionLog`)
- [ ] Distingo `in-memory` (sin dependencias) de `prisma` (integración real)
- [ ] Conozco las cinco reglas de AGENTS.md que no se negocian

## Próximo paso

El PR #12 (`auth-hardening` → `develop`) ya está mergeado: el estado actual de auth se lee directo en `develop`. Después, leer `02-integrando-el-esp32.md` para el scaffold ya mergeado (PR #14) y el siguiente real (GPIO de relés), y `03-desafios-y-como-se-resuelven.md` para el contexto de decisiones difíciles.

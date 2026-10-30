# Design: IIoT Extensibility Seams

## Technical Approach

Three seams behind token-switch (`DATA_SOURCE`) + `@Global DatabaseModule`. Order: driver → telemetry → transport. `ActionsService` becomes orchestrator: resolve → capability check → dispatch via one token → log. Routes, `ValidationPipe` + filter unchanged.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Registry (`DRIVER_REGISTRY` map) + resolver (`DEVICE_DRIVER`) vs switch-case | Map adds a file; switch re-couples | Registry + resolver: new driver = new provider, service untouched |
| Endpoint table in driver vs shared util | Duplication risk | `Esp32Driver.resolveEndpoint()` owns table; delete copies in service + HTTP client |
| Dispatcher token `DEVICE_TRANSPORT` vs keep `ESP32_CLIENT` | Rename churn | Dispatcher; `HttpTransport` = verbatim `Esp32HttpClientService.sendAction`; `MqttTransport` stub; select by `device.driver` + `MQTT_ENABLED` |
| Telemetry module + `TELEMETRY_REPOSITORY` vs reuse ActionLog | New table cost | New module + token (InMemory/Prisma), mirrors `DEVICE_REPOSITORY` |
| Nullable ip/port conditional validation vs per-driver DTOs | Logic in one DTO | One DTO + `ValidateIf` rules below; controllers stay thin |

## Data Flow

Action: `Controller → ActionsService → DriverResolver → capability check → TransportDispatcher → ActionLog`

```
POST /devices/:id/actions ──→ ActionsService ──→ DEVICE_DRIVER (resolver)
                                     │ 400 unknown driver (no device contact)
                                     ├──→ supports(target)? ──→ 400 if unsupported, no log
                                     └──→ DEVICE_TRANSPORT ──→ HttpTransport | MqttTransport stub
                                                              └──→ 502 + failed log on unreachable
```

Telemetry: `POST /devices/:id/telemetry/batch → TelemetryService → TELEMETRY_REPOSITORY → Prisma/InMemory`; `GET .../telemetry?metric&from&to&limit → bounded query`.

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/devices/drivers/device-driver.interface.ts` | Create | `DeviceDriver` contract |
| `backend/src/devices/drivers/esp32.driver.ts` | Create | Owns endpoint table, moved verbatim |
| `backend/src/devices/drivers/driver-resolver.service.ts` | Create | Resolver over registry; 400 fail-closed |
| `backend/src/devices/constants/driver.tokens.ts` | Create | `DEVICE_DRIVER`, `DRIVER_REGISTRY` |
| `backend/src/actions/transport/device-transport.interface.ts` | Create | `DeviceTransport` contract |
| `backend/src/actions/transport/http-transport.service.ts` | Create | Verbatim `sendAction` extraction |
| `backend/src/actions/transport/mqtt-transport.service.ts` | Create | Publish-once stub; no broker dep |
| `backend/src/actions/transport/transport-dispatcher.service.ts` | Create | `DEVICE_TRANSPORT`; routes by driver; 502 intact |
| `backend/src/telemetry/*` | Create | Module, thin controller/service, token, InMemory + Prisma repos, DTOs |
| `backend/prisma/schema.prisma` | Modify | Device fields + `TelemetryReading` + indexes |
| `backend/src/actions/actions.service.ts` | Modify | Orchestrator only; delete `resolveEndpoint` |
| `backend/src/actions/actions.module.ts` | Modify | Wire registry + dispatcher; keep `DATA_SOURCE` switch |
| `backend/src/devices/dto/*`, `actions/dto/*`, `action.interface.ts` | Modify | Widening + conditional validation; `parseTarget` pass-through |
| `frontend/.../actions/route.ts`, zone-card | Modify | Widen `target: string`; shape unchanged |

## Interfaces / Contracts

```ts
interface DeviceDriver { name: string; supports(t: string): boolean; resolveEndpoint(a: string, t: string): string; transport: 'http'|'mqtt'; }
interface DeviceTransport { send(device: Device, cmd: ActionCommand): Promise<{ endpoint: string; httpStatusCode: number }>; }
interface TelemetryRepository { ingestMany(r: Omit<TelemetryReading,'id'>[]): Promise<number>; query(deviceId: string, q: { metric?: string; from: Date; to: Date; limit: number }): Promise<TelemetryReading[]>; }
```

Conditional validation (risk 2): `driver` default `'esp32'`; `mqttTopic` optional; `ipAddress: @ValidateIf(o => o.driver==='esp32' || !o.mqttTopic) @IsIP('4')` else optional; `port: @ValidateIf(same) @IsInt @Min(1) @Max(65535)` else optional. Uniqueness check only when ip+port present.
DTO widening: `target: string` (`@IsString @IsNotEmpty`, drop `@IsIn`); `DeviceTarget = string`; service capability check replaces `IsIn`/`parseTarget`; `forbidNonWhitelisted` unchanged.

```prisma
model Device { driver String @default("esp32"); capabilities String[] @default(["riego","luces"]); mqttTopic String? @map("mqtt_topic"); ipAddress String?; port Int?; telemetry TelemetryReading[] }
model TelemetryReading { id String @id @default(uuid()) @db.Uuid; deviceId String @map("device_id") @db.Uuid; ts DateTime; metric String @db.VarChar(60); value DoublePrecision; unit String?; source String?; device Device @relation(fields:[deviceId], references:[id], onDelete: Cascade); @@index([deviceId, ts]); @@index([deviceId, metric, ts]); @@map("telemetry_readings") }
```

Error mapping (risk 1): all `PrismaTelemetryRepository` calls try/catch: `P2002 → Conflict`, `P2025 → NotFound`/null, `P2003 → BadRequest`, else log + 500. Invalid batch → 400, nothing stored; unknown device → 404; unbounded (`limit>1000`, window>7d, missing `from`/`to`) → 400 or default last-24h + `limit=1000`. Unreachable → 502 + id/timestamp log + failed log, unchanged.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Resolver fail-closed, capability 400, dispatcher routing, conditional DTO validation, repo error mapping (P2002/P2025/generic) | Jest specs mirroring `actions.service.spec.ts` |
| Integration | Batch ingest + cascade delete + bounded range on both `DATA_SOURCE` modes | Prisma + InMemory suites |
| E2E | HTTP 502 contract unchanged; MQTT stub publishes once, no subscribe | Existing e2e + stub spy |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

One migration: nullable columns + defaults (`driver='esp32'`, `capabilities=['riego','luces']`), `ip_address`/`port` nullable (`@@unique` keeps, NULLs exempt), create `telemetry_readings` + indexes. No backfill. Rollback: revert PR; down-migration drops that table only — device rows spared. Slices <400 lines: driver → telemetry → transport.

## Open Questions

None — MQTT full-broker, TSDB, auth hardening explicitly deferred.

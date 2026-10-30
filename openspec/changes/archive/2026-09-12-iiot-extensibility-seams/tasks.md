# Tasks: IIoT Extensibility Seams

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 800–1100 (8+ new files, migration, 3 test layers) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 driver → PR 2 telemetry → PR 3 transport + widening |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Driver seam (registry, resolver, ESP32 driver, DTO widening) | PR 1 | `npm run test -- --runInBand` (from `backend/`) | `docker compose -f docker-compose.local.yml up --build`, `POST /devices/:id/actions` | Revert driver files + `actions.service.ts`; no migration |
| 2 | Telemetry seam (model, migration, module, ingest + range query) | PR 2 | `npm run test:e2e` (from `backend/`) | Same compose stack, batch `POST /devices/:id/telemetry/batch` + `GET` range | Down-migration drops `telemetry_readings` only; device rows spared |
| 3 | Transport dispatch (HTTP extraction, MQTT stub, dispatcher, frontend types) | PR 3 | `npm run test -- --runInBand` + `npm run lint` (from `frontend/`) | Same stack; unreachable device asserts 502 + failed log | Revert transport files + dispatcher wiring; stub has no broker dep |

## Phase 1: Foundation (contracts + model)

- [x] 1.1 Create `backend/src/devices/drivers/device-driver.interface.ts` with `DeviceDriver` contract (`name`, `supports`, `resolveEndpoint`, `transport`).
- [x] 1.2 Create `backend/src/devices/constants/driver.tokens.ts` with `DEVICE_DRIVER` + `DRIVER_REGISTRY` tokens.
- [x] 1.3 Create `backend/src/actions/transport/device-transport.interface.ts` with `DeviceTransport` contract.
- [x] 1.4 Modify `backend/prisma/schema.prisma`: nullable `ipAddress`/`port`, `driver`/`capabilities`/`mqttTopic`, new `TelemetryReading` + indexes; add migration (no backfill).
- [x] 1.5 Widen `backend/src/actions/dto/*`, `backend/src/devices/dto/*`, `action.interface.ts`: `target: string`, conditional `ValidateIf` on `ipAddress`/`port`.

## Phase 2: Core Implementation (drivers, telemetry, transport)

- [x] 2.1 Create `backend/src/devices/drivers/esp32.driver.ts` owning the endpoint table; delete copies in service + HTTP client.
- [x] 2.2 Create `backend/src/devices/drivers/driver-resolver.service.ts`: registry lookup, 400 fail-closed without device contact.
- [x] 2.3 Create `backend/src/telemetry/*`: module, thin controller/service, `TELEMETRY_REPOSITORY` token, InMemory + Prisma repos, ingest/query DTOs.
- [x] 2.4 Create `backend/src/actions/transport/http-transport.service.ts` via verbatim `sendAction` extraction.
- [x] 2.5 Create `backend/src/actions/transport/mqtt-transport.service.ts` publish-once stub (no subscribe/state/retry/broker) + `MQTT_ENABLED` config switch.
- [x] 2.6 Create `backend/src/actions/transport/transport-dispatcher.service.ts` (`DEVICE_TRANSPORT`); route by `device.driver`; keep 502 + id/timestamp log.
- [x] 2.7 Modify `backend/src/actions/actions.service.ts` (orchestrator: resolve → capability 400 → dispatch → log; delete `resolveEndpoint`) and `backend/src/actions/actions.module.ts` wiring.
- [x] 2.8 Modify `frontend/app/api/devices/[deviceId]/actions/route.ts` and zone-card: widen `target: string`, route shape unchanged.

## Phase 3: Testing (per design strategy)

- [x] 3.1 Unit (Jest): resolver fail-closed, capability 400, dispatcher routing, conditional DTO validation, repo P2002/P2025/generic mapping.
- [x] 3.2 Integration: batch ingest + cascade delete + bounded range on both `DATA_SOURCE` modes; invalid batch → 400 nothing stored.
- [x] 3.3 E2E: HTTP 502 contract unchanged; MQTT stub publishes once with spy, no subscribe.

## Phase 4: Cleanup

- [x] 4.1 Mark MQTT full-broker/TSDB follow-ups as TODOs; confirm no business logic on ESP32, no frontend→device calls.
- [x] 4.2 Run `npm run lint` + `npm run build` from `backend/` and `frontend/`; fix violations.

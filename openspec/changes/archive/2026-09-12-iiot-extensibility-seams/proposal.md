# Proposal: IIoT Extensibility Seams

## Intent

The hub is hard-coupled to ESP32-over-HTTP, hardcoded riego/luces targets, no telemetry store. Three bounded seams — driver, telemetry, transport — let new devices, MQTT, and AI consumers attach without a rewrite.

## Scope

### In Scope

- Driver seam: DEVICE_DRIVER/DRIVER_REGISTRY tokens + resolver; ESP32 becomes one driver; Device gains driver/capabilities/mqttTopic?, nullable ip/port; capability-checked targets; resolveEndpoint collapses into drivers.
- Telemetry seam: TelemetryModule + TelemetryRepository token (InMemory + Prisma); TelemetryReading (deviceId FK cascade, ts, metric, value, unit?, source?) indexed on (deviceId,ts), (deviceId,metric,ts); batch POST ingest + GET range query with ML-ready JSON.
- Transport scaffold: DeviceTransport interface; HttpTransport extracts current fetch verbatim; publish-only MqttTransport stub + config switch; ActionsService calls one dispatcher token.
- DTO widening: ExecuteActionDto, action interfaces, parseTarget, frontend proxy + zone-card types; route shapes unchanged.

### Out of Scope

- Auth/service-role/JWT hardening (separate blocker); Relay CRUD; Zones/Scenes; rate limiting; broker subscribe/state/retries; TSDB/Grafana; firmware/; full-duplex WS/MQTT; voice/HA/energy.

## Capabilities

### New Capabilities

- `device-driver`: driver resolution, capability-checked targets, endpoint consolidation.
- `telemetry-ingest`: batch ingest + range query for ML consumers.
- `device-transport`: HTTP/MQTT dispatcher, publish-only MQTT stub.

### Modified Capabilities

- None — no openspec/specs/ baseline yet.

## Approach

Order: driver → telemetry → MQTT stub behind DATA_SOURCE/config switches. Reuse token-switch and @Global DatabaseModule patterns. Preserve thin controllers, Prisma try/catch → HttpException, unreachable → 502 with id + timestamp, Frontend → Backend → Device, n8n-as-trigger, ValidationPipe + HttpExceptionFilter.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/actions/` | Modified | Driver/transport tokens, dispatcher, widened DTO |
| `backend/src/devices/` | Modified | New Device fields, nullable ip/port |
| `backend/src/telemetry/` | New | Module, repository impls, ingest/query endpoints |
| `backend/prisma/schema.prisma` | Modified | Device fields + TelemetryReading + indexes |
| `frontend/app/api/devices/[deviceId]/actions/` | Modified | Proxy type widening, same shape |
| `frontend/components/dashboard/` | Modified | Zone-card type widening only |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Nullable ip/port breaks device validation | Med | Nullable columns + conditional DTO validation |
| Telemetry growth without TSDB | Med | Indexes + bounded ranges; TSDB deferred |
| MQTT stub mistaken for full support | Low | Publish-only naming + TODOs + docs |

## Rollback Plan

Revert one PR. If TelemetryReading migrated, a down-migration drops that table only; nullable columns spare device rows.

## Dependencies

- None — no new infra; stub needs no broker.

## Success Criteria

- [ ] New driver registers via DRIVER_REGISTRY; ActionsService untouched
- [ ] Telemetry ingest + range query pass on both DATA_SOURCE modes
- [ ] HTTP behavior unchanged incl. 502 contract; MQTT stub explicit
- [ ] Slices stay within 400-line budget

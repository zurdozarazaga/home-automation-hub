# Telemetry Ingest Specification

## Purpose

Persist device time-series, serve bounded range queries for ML consumers; ActionLog is not a series store.

## Requirements

### Requirement: Batch Ingest

The system MUST accept batch POST ingest of readings (deviceId, ts, metric, value, optional unit/source) via a TelemetryRepository token with InMemory and Prisma implementations. Storage MUST cascade on device delete, index (deviceId,ts) and (deviceId,metric,ts). Invalid payloads MUST yield 400; Prisma failures MUST map to HttpException.

#### Scenario: Valid batch stored

- GIVEN well-formed readings for a known device
- WHEN ingest is called
- THEN readings persist and a count returns

#### Scenario: Invalid entry rejected

- GIVEN a batch with a bad reading
- WHEN ingest is called
- THEN rejection with 400, nothing stored

#### Scenario: Device delete cascades readings

- GIVEN a device with stored readings
- WHEN the device is deleted
- THEN its readings vanish

### Requirement: Range Query

The system MUST serve GET range queries by deviceId, metric, and time window as bounded ML-ready JSON; unbounded input MUST be rejected or default-bounded; unknown devices MUST yield 404. Controllers MUST stay thin.

#### Scenario: Bounded range returns readings

- GIVEN stored readings for a device
- WHEN a bounded range is queried
- THEN time-ordered JSON returns

#### Scenario: Unbounded query refused

- GIVEN a windowless range query
- WHEN it is called
- THEN 400 or default bound applied

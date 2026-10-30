# Device Transport Specification

## Purpose

One dispatcher token: HTTP keeps current behavior, MQTT is a publish-only stub; frontend calls backend only.

## Requirements

### Requirement: Transport Dispatch

ActionsService MUST call one dispatcher token, never a hardcoded client. HTTP MUST behave as today: unreachable yields 502 with id plus timestamp logged and a failed ActionLog. Controllers MUST stay thin.

#### Scenario: HTTP path unchanged

- GIVEN an HTTP-reachable device
- WHEN an action executes
- THEN result, endpoint, and log match today

#### Scenario: Unreachable yields 502

- GIVEN an unreachable device
- WHEN an action executes
- THEN 502, id plus timestamp logged, failed log written

### Requirement: Publish-Only MQTT Stub

The system MUST offer a publish-only MqttTransport stub chosen via config switch. The stub MUST NOT subscribe, hold state, or retry, and MUST need no broker; full-broker work stays out of scope behind TODOs.

#### Scenario: MQTT command uses stub

- GIVEN MQTT selected, device has mqttTopic
- WHEN an action executes
- THEN the stub publishes once

#### Scenario: Stub never subscribes

- GIVEN any MQTT device
- WHEN any action executes
- THEN no subscription, no state held

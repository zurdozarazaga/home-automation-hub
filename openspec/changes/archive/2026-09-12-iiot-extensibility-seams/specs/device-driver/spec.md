# Device Driver Specification

## Purpose

Detach actions from ESP32-over-HTTP; new families attach as registered drivers, ActionsService untouched.

## Requirements

### Requirement: Driver Resolution

The system MUST resolve each Device to a registered driver via DEVICE_DRIVER/DRIVER_REGISTRY tokens; endpoints MUST live inside drivers, never ActionsService. Unknown drivers MUST fail closed without device contact.

#### Scenario: ESP32 device resolves

- GIVEN a device with driver "esp32"
- WHEN an action executes
- THEN the ESP32 driver dispatches it

#### Scenario: Unknown driver fails closed

- GIVEN a device with unregistered driver
- WHEN an action executes
- THEN rejection with 400, no device contact

#### Scenario: New driver needs no change

- GIVEN a newly registered driver
- WHEN its target executes
- THEN the driver supplies the endpoint

### Requirement: Capability-Checked Targets

The system MUST check the target against device capabilities before dispatch, never hardcode riego/luces in services. ExecuteActionDto, interfaces, parseTarget, frontend proxy, and zone-card types MUST accept driver-declared targets; route shapes unchanged under the global ValidationPipe.

#### Scenario: Supported target proceeds

- GIVEN a capability-listed target
- WHEN an action executes
- THEN dispatch proceeds to transport

#### Scenario: Unsupported target rejected

- GIVEN a non-capability target
- WHEN an action executes
- THEN rejection with 400, no success log

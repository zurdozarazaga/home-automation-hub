# auth-rbac Specification

## Purpose

JWT authentication and role-based access control for the backend API, including a least-privilege `service` role so n8n acts only as an authenticated trigger source via the backend. Devices, actions, and n8n dispatch entry points deny unauthenticated and unauthorized callers by default.

## Requirements

### Requirement: Service Role

The system MUST support exactly three roles: `admin`, `viewer`, and `service`. The `service` role MUST be scoped to triggering action execution and MUST NOT grant device administration.

#### Scenario: Role set includes service

- GIVEN the role model
- WHEN a caller authenticates with the `service` role
- THEN the system recognizes it as distinct from `admin` and `viewer`

### Requirement: Service Credential Issuance and Rotation

The system MUST issue short-lived JWTs for the n8n service account and MUST support rotation. Expired or revoked service tokens MUST be rejected.

#### Scenario: Rotate compromised service token

- GIVEN a service token is suspected leaked
- WHEN a new token is issued and the old one is revoked
- THEN calls with the old token fail and calls with the new token succeed

#### Scenario: Expired token rejected

- GIVEN a service token past its expiry
- WHEN it calls any protected endpoint
- THEN the system responds 401

### Requirement: Deny-by-Default Enforcement

All device, action, and n8n dispatch endpoints MUST require a valid JWT. Requests with a missing or invalid token MUST yield 401; requests with a valid token lacking the required role MUST yield 403.

#### Scenario: Unauthenticated device call rejected

- GIVEN no Authorization header
- WHEN calling `GET /devices`
- THEN the system responds 401

#### Scenario: Wrong role rejected

- GIVEN a valid JWT with an insufficient role
- WHEN calling a protected endpoint
- THEN the system responds 403

### Requirement: Device Endpoint Authorization

Device management endpoints MUST allow full CRUD for `admin` and read-only access for `viewer`. The `service` role MUST NOT manage devices.

#### Scenario: Viewer cannot create devices

- GIVEN a valid `viewer` JWT
- WHEN calling `POST /devices`
- THEN the system responds 403

#### Scenario: Service cannot manage devices

- GIVEN a valid `service` JWT
- WHEN calling `POST /devices`
- THEN the system responds 403

### Requirement: Action Execution Authorization

`POST /devices/:id/actions` MUST accept `admin` and `service` callers and MUST reject `viewer` callers with 403 and unauthenticated callers with 401.

#### Scenario: Service executes action

- GIVEN a valid `service` JWT
- WHEN calling `POST /devices/:id/actions` with a valid body
- THEN the system executes the action and audits the result

#### Scenario: Viewer cannot execute actions

- GIVEN a valid `viewer` JWT
- WHEN calling `POST /devices/:id/actions`
- THEN the system responds 403 and executes nothing

### Requirement: N8n Dispatch Authorization

`POST /integrations/n8n/actions` MUST require the `service` role. All other roles MUST receive 403 and missing credentials MUST receive 401.

#### Scenario: Non-service caller rejected from dispatch

- GIVEN a valid `viewer` JWT
- WHEN calling `POST /integrations/n8n/actions`
- THEN the system responds 403 and dispatches nothing

### Requirement: Frontend Proxy Propagation

The frontend API proxy MUST forward the caller Authorization header to the backend, MUST surface upstream 401/403/502 statuses unchanged, and MUST NOT call ESP32 devices directly.

#### Scenario: Proxy forwards credentials

- GIVEN an authenticated UI session calling an action
- WHEN the proxy forwards `POST /devices/:id/actions`
- THEN the backend receives the caller Authorization header

### Requirement: Auth Coverage

Guard unit tests plus backend e2e tests MUST cover the 401/403 matrix for devices, actions, and n8n dispatch, including the service-can-execute / viewer-cannot case.

#### Scenario: Matrix covered in CI

- GIVEN the CI pipeline runs backend unit and e2e suites
- WHEN the auth matrix regresses
- THEN at least one test fails

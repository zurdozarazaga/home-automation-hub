# Proposal: Auth Hardening

## Intent

Devices/Actions endpoints are unauthenticated: `RolesGuard` is a passthrough and no controller enforces guards. This blocks any prod exposure per Security-first priority. Harden JWT + RBAC now, adding the `service` role so n8n acts only as authenticated trigger source via backend.

## Scope

### In Scope

- Add `service` role; JWT issuance and rotation for n8n service account
- Fix `RolesGuard` to validate JWT and enforce roles, deny by default
- Enforce `UseGuards` on Devices, Actions, and N8n dispatch entry points
- Guard unit plus e2e auth coverage; Backend/Frontend CI green

### Out of Scope

- Relay CRUD, zones/scenes, weather/sensors, `firmware/`
- Deployment target decision (deferred; nothing deployed yet)
- Manual edits in n8n.opi.ar workflow UI (forbidden; swap via MCP later)
- MQTT-node swap and full n8n wiring (follow-up `n8n-e2e`); rate limiting (separate change)

## Capabilities

### New Capabilities

- `auth-rbac`: JWT + RBAC including `service` role for n8n; guard enforcement on device, action, and n8n entry points

### Modified Capabilities

- None (existing `device-driver`, `device-transport`, `telemetry-ingest` specs unchanged)

## Approach

Extend Role enum, implement JWT strategy with deny-by-default `RolesGuard`, apply `UseGuards` to controllers and dispatch, issue rotatable service JWT for n8n. Branch from `develop`, PR to `develop` with conventional commits; single PR expected under 400-line budget.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/auth/` | Modified | Role enum, JWT strategy, `RolesGuard` fix |
| `backend/src/devices/` | Modified | Enforce guards on controller |
| `backend/src/actions/` | Modified | Enforce guards on controller |
| `backend/src/integrations/n8n/` | Modified | Guard wiring prep for dispatch (no MQTT swap) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Service token leak grants device control | Med | Short-lived JWT, rotation docs, least-privilege `service` scope |
| Guard breaks frontend proxy calls | Med | Update proxy auth headers plus e2e coverage before merge |
| Scope creep into n8n-e2e | Low | Hard boundary: no MQTT swap in this change |

## Rollback Plan

Revert PR via `git revert`; revoke issued service JWTs; keep endpoints unexposed publicly until re-landed. Verify with unauthenticated e2e expecting 401/403.

## Dependencies

- Branch from `develop`, PR to `develop`; no broker, device, or n8n UI dependency

## Success Criteria

- [ ] Unauthenticated device/action calls return 401/403
- [ ] `service` JWT executes `POST /devices/:id/actions`; viewer cannot
- [ ] Backend `test`, `test:e2e`, `lint`, `build` and frontend `lint`, `build` pass

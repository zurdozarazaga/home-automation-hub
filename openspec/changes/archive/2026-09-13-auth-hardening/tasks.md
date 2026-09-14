# Tasks: Auth Hardening

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 320–380 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR to `develop` |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

Assumptions (do not block): service JWT TTL defaults to 24h; viewer-gated dashboard controls deferred unless e2e requires them. Threat matrix N/A per design — no RED-test tasks. Flag: if n8n dispatch delegation grows beyond replace-501 + guard, split PR 2.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Guards + roles + CLI | PR 1 | `npm run test -- auth` | N/A (unit only) | Revert `backend/src/auth/` |
| 2 | Controller wiring + proxy + e2e | PR 1 | `npm run test:e2e -- auth` | `docker compose -f docker-compose.local.yml up --build` + manual Bearer calls | Revert controllers + proxy route |

## Phase 1: Foundation

- [x] 1.1 Add `@nestjs/jwt` to `backend/package.json`, wire `JWT_SECRET` via `backend/src/auth/auth.module.ts`. Test: `npm run build` passes.
- [x] 1.2 Extend `Role` in `backend/src/auth/interfaces/role.interface.ts` with `'service'`; create `backend/src/auth/interfaces/jwt-payload.interface.ts` (`sub`, `role`, `iat`, `exp`). Test: `tsc` build passes.
- [x] 1.3 Create `backend/src/auth/guards/jwt-auth.guard.ts` (Bearer verify via `JwtService`, set `request.user`, 401 on missing/invalid/expired, honor `@Public()`). Test: unit spec missing/malformed/expired → 401.

## Phase 2: Core Implementation

- [x] 2.1 Fix `backend/src/auth/guards/roles.guard.ts` (real `@Roles()` check, deny-by-default, 403 on mismatch). Test: guard spec deny/match/mismatch.
- [x] 2.2 Wire `JwtModule` + global `APP_GUARD`s (`JwtAuthGuard`, `RolesGuard`) in `backend/src/auth/auth.module.ts`. Test: unauthenticated `GET /devices` → 401.
- [x] 2.3 Create `backend/src/auth/scripts/issue-service-token.ts` + `auth:issue-service` script (`sub=n8n-sistema-riego`, `role=service`, 24h TTL). Test: CLI mints token verifiable by `JwtService`.
- [x] 2.4 Annotate `backend/src/devices/devices.controller.ts` (reads `admin,viewer`; mutations `admin`), `backend/src/actions/actions.controller.ts` (`admin,service`), `backend/src/integrations/n8n/n8n.controller.ts` (`service`), `backend/src/health/health.controller.ts` + root `@Public()`. Test: role matrix spot-checks.

## Phase 3: Integration

- [x] 3.1 Delegate `POST /integrations/n8n/actions` to `ActionsService.execute` in `backend/src/integrations/n8n/` (replace 501; keep DTO validation). Test: service → executes + audits; viewer → 403.
- [x] 3.2 Forward `Authorization` unchanged in `frontend/app/api/devices/[deviceId]/actions/route.ts`; pass through 401/403/502 status/body. Test: proxy forwards header, no direct ESP32 call.
- [x] 3.3 Attach admin JWTs to existing `backend/test/app.e2e-spec.ts` device/action cases. Test: `npm run test:e2e` green.

## Phase 4: Testing

- [x] 4.1 Add guard unit specs (`JwtAuthGuard` + `RolesGuard`) covering 401/403 matrix incl. service-executes/viewer-denied. Test: `npm run test`.
- [x] 4.2 Create `backend/test/auth.e2e-spec.ts` covering spec scenarios (unauthenticated 401, viewer-create 403, service-execute success, expired 401, dispatch non-service 403). Test: `npm run test:e2e`.
- [x] 4.3 Verify full CI: backend `test`, `test:e2e`, `lint`, `build`; frontend `lint`, `build`. Test: CI green.

## Phase 5: Cleanup

- [x] 5.1 Update `docs/integrations/n8n.md` issuance/rotation runbook (24h TTL, re-issue flow, `JWT_SECRET` rotation). Test: doc review.
- [x] 5.2 Run `npm run lint` + `npm run format`; confirm no schema change, no MQTT swap, no manual n8n.opi.ar edits. Test: clean diff.

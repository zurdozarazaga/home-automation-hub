# Apply Progress: Auth Hardening

- Change: `auth-hardening`
- Branch: `feat/auth-hardening` (from `develop`, not merged; no PR opened)
- Mode: Standard (strict_tdd false per `openspec/config.yaml`)
- Evidence revision: `apply-auth-hardening-001`
- Tasks: 15/15 complete (`tasks.md` all `[x]`)
- Workload: single PR to `develop`; hand-authored diff 665 lines
  (+575/−90 tracked, includes new-file bodies) + 133 generated lock lines.
  Recommends `size:exception` — see Workload section.

## Commits (work units)

| SHA | Message |
|-----|---------|
| `694d38cf2fb3dfd7edc73d8731a744e56950d4db` | feat(backend): add JWT auth guards with service role |
| `1ffcbafaeb285260b18446ba4ceaef66df09f53a` | feat(backend): issue offline service tokens for n8n |
| `53af4d47afd87df8682332d5ebc89b3bb5a0c6aa` | feat(backend): enforce RBAC on devices, actions and n8n dispatch |
| `c992100b19ef6a79f39bb02933bdaf1ed9c994e3` | feat(frontend): forward Authorization through actions proxy |
| `564cd8a46a49aa391a4297218882d83ed62bf3f4` | test(backend): cover 401/403 auth matrix |
| `90d42d9de56870c81bea36307c1cf75c20f3891c` | docs(n8n): add service token issuance and rotation runbook |

## Completed tasks

- [x] 1.1 `@nestjs/jwt` 11.0.2 added; `JWT_SECRET` wired in `auth.module.ts`;
  `auth:issue-service` script registered. (`npm run build` shows only the
  6 pre-existing prisma errors — see Issues.)
- [x] 1.2 `Role` extended with `'service'`; `JwtPayload` created
  (`sub`, `role`, `iat?`, `exp?`).
- [x] 1.3 `JwtAuthGuard` created: Bearer verify via `JwtService`,
  `request.user` set, 401 on missing/malformed/invalid/expired, `@Public()`
  bypass.
- [x] 2.1 `RolesGuard` fixed: real `@Roles()` check, deny-by-default
  (no metadata or no match → 403), `@Public()` bypass.
- [x] 2.2 Global `APP_GUARD`s (`JwtAuthGuard` → `RolesGuard`) via
  `useExisting` in `auth.module.ts`; `JwtModule` 24h expiry.
- [x] 2.3 `issue-service-token.ts` CLI (`sub=n8n-sistema-riego`,
  `role=service`, 24h TTL); refuses to run without `JWT_SECRET`;
  import-safe export covered by unit spec.
- [x] 2.4 Role matrix applied: devices reads (`admin,viewer`) / mutations
  (`admin`); actions POST (`admin,service`); n8n dispatch (`service`);
  health + root `@Public()`.
- [x] 3.1 `POST /integrations/n8n/actions` delegates to
  `ActionsService.execute(deviceId, dto)` via `N8nTriggerActionDto`
  (`deviceId` UUID + action/target, validation kept); 501 placeholder and
  unused `N8nService` removed; stale `TODO(auth)`/`TODO(n8n)` comments gone.
  Scope stayed at replace-501 + guard — no split needed.
- [x] 3.2 Proxy forwards `Authorization` unchanged; 401/403/502 status/body
  pass through untouched; no direct ESP32 call.
- [x] 3.3 `app.e2e-spec.ts` device/action cases carry admin JWTs; `/` and
  `/health*` cases intentionally unauthenticated (prove `@Public()`).
- [x] 4.1 Guard unit specs: 401/403 matrix incl. service-executes /
  viewer-denied (12 tests with CLI spec).
- [x] 4.2 `test/auth.e2e-spec.ts`: unauthenticated 401, expired 401,
  viewer-create 403, service-manage 403, service-execute success,
  viewer-execute 403, dispatch service-only, health public (7 tests).
- [x] 4.3 Full CI run (see Evidence). Backend unit + lint green; frontend
  lint + build green; e2e has 1 pre-existing failure (see Issues).
- [x] 5.1 `docs/integrations/n8n.md` runbook: 24h TTL issuance, re-issue
  flow, `JWT_SECRET` rotation, 401 symptom. Stale "service is TODO" text
  replaced.
- [x] 5.2 `lint` + `format` clean. No schema change, no MQTT/websocket
  logic (only a removed stale TODO line matches), no n8n.opi.ar edits.

## Work Unit Evidence

### Unit 1 — Guards + roles + CLI

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npm run test -- --runInBand src/auth` (from `backend/`) → 3 suites, 12 tests, all pass |
| Runtime harness and exact result | N/A (unit only) — no runtime boundary in this unit |
| Rollback boundary | Revert `backend/src/auth/` + `backend/package.json` dep/script; guards are additive until Unit 2 wires them globally |

### Unit 2 — Controller wiring + proxy + e2e

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npm run test:e2e` (from `backend/`) → 13 pass, 1 fail (pre-existing 502 case, fails identically on clean `develop`); `npm run test -- --runInBand` → 6 suites, 23 tests, all pass |
| Runtime harness and exact result | `npm run build` (from `frontend/`) → success, route `/api/devices/[deviceId]/actions` compiled; full docker harness not run (no DB/device needed for in-memory path; e2e supertest covers the HTTP boundary) |
| Rollback boundary | Revert controllers + `n8n.controller/module/DTO` + proxy route + e2e specs; `N8nService` deletion restores by re-adding the file and provider |

## Deviations from design

- `N8nService` placeholder deleted (instead of left unused): the 501 contract
  it implemented no longer exists and its TODOs described exactly this wiring.
  `N8nModule` now exposes only the delegating controller.
- `n8n/README.md` rewritten from "skeleton/501" to "guarded dispatch" so
  docs do not contradict the code (same reason, minimal lines).
- `JWT_SECRET` falls back to `'test-secret'` outside production (mirrored in
  e2e specs) so unit/e2e run without env wiring; production has no default.
  Documented inline and in the n8n runbook.

## Issues found (pre-existing, out of scope, not fixed)

1. `npm run build` fails on clean `develop` with 6 TS errors in
   `backend/src/devices/repositories/prisma-device.repository.ts`
   (Prisma nullable `ipAddress`/`port` vs device interface). Verified via
   `git stash` + rebuild. Auth change adds zero new build errors.
2. `app.e2e-spec.ts` "unreachable device → 502" fails on clean `develop`:
   the test mocks `fetch` rejection, but the default in-memory ESP32 client
   never calls `fetch`, so the action returns 201. Same failure with and
   without this change. Left untouched (fixing it means changing the 502
   test strategy, outside auth scope).

## Workload / PR boundary

- Mode: single PR to `develop` (forecast: Medium risk, chained No).
- Boundary: Phase 1 → Phase 5, all 15 tasks, one cohesive RBAC unit.
- Review impact: 665 hand-authored lines + 133 generated lock lines —
  exceeds the 400-line budget. Tests were kept compact (no padding removed
  per policy); the matrix coverage the spec demands (guard units + e2e)
  cannot shrink further without dropping required scenarios.
- Recommendation: land as single PR with `size:exception`.

## Status

15/15 tasks complete. Ready for verify (`sdd-verify`). Do not merge before
verify; PR not opened yet.

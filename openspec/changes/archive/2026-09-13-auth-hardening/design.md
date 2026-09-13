# Design: Auth Hardening

## Technical Approach

Close the unauthenticated Devices/Actions surface by completing the skeleton in `backend/src/auth/`: add the `service` role, verify Bearer JWTs in a new `JwtAuthGuard`, fix `RolesGuard` to enforce `@Roles()` deny-by-default, guard the Devices, Actions, and n8n dispatch entry points, and forward `Authorization` through the Next.js action proxy. Covers the proposal and all 8 `auth-rbac` requirements; no schema change.

## Architecture Decisions

### Decision: Guard composition

| Option | Tradeoff | Decision |
|---|---|---|
| Single combined AuthGuard | Mixes authentication with authorization | Reject |
| `JwtAuthGuard` (401) + `RolesGuard` (403), both global `APP_GUARD` | 401/403 split per spec; `@Public()` escape for health | **Adopt** |

Rationale: spec demands distinct 401 vs 403; two guards keep each status attributable and unit-testable.

### Decision: JWT library

| Option | Tradeoff | Decision |
|---|---|---|
| `jsonwebtoken` directly | Manual secret handling, no DI | Reject |
| `@nestjs/jwt` (`JwtService`) | NestJS DI pattern, injectable, testable | **Adopt** |

Rationale: idiomatic NestJS; no Passport for Bearer-only JWTs.

### Decision: Service credential issuance and rotation

| Option | Tradeoff | Decision |
|---|---|---|
| HTTP issuance endpoint | Bootstrapping problem; widens attack surface | Reject |
| Offline CLI script (`npm run auth:issue-service`) signing `sub=n8n-sistema-riego`, `role=service`, short TTL | No new endpoint; rotation = re-issue, update n8n credential | **Adopt** |

Rationale: revocation without a token store — short TTL bounds leak blast radius; full invalidation via `JWT_SECRET` rotation. Runbook goes in `docs/integrations/n8n.md`.

### Decision: Least-privilege role matrix

| Option | Tradeoff | Decision |
|---|---|---|
| `service` inherits viewer reads | Violates least privilege | Reject |
| Strict split: `admin` CRUD + execute; `viewer` device reads only; `service` action-execute only | Dashboard gates mutate UI on role; n8n resolves device IDs out-of-band | **Adopt** |

Rationale: matches the spec matrix exactly; dashboard needs hold because read views stay viewer-accessible while action controls are admin-gated. `service` only triggers actions, never device CRUD.

## Data Flow

Request path: caller → `JwtAuthGuard` (401) → `RolesGuard` (403) → controller → service → ESP32/`ActionLog`. Sequence (per `rules.design`):

```
n8n ──POST /devices/:id/actions (Bearer service)──→ Backend
Backend ──verify JWT──→ 401 if expired/invalid
Backend ──check @Roles(admin, service)──→ 403 if viewer
Backend ──ActionsService.execute──→ ESP32
ESP32 down ──→ 502 + ActionLog(result=failed) [unchanged]
```

Frontend path: browser → proxy (forwards `Authorization` unchanged) → backend; 401/403/502 pass through untouched, ESP32 never contacted directly.

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/auth/interfaces/role.interface.ts` | Modify | Add `'service'` to `Role` union |
| `backend/src/auth/interfaces/jwt-payload.interface.ts` | Create | `JwtPayload` (`sub`, `role`, `iat`, `exp`) |
| `backend/src/auth/guards/jwt-auth.guard.ts` | Create | Verify Bearer via `JwtService`; set `request.user`; 401 on missing/invalid/expired; honor `@Public()` |
| `backend/src/auth/guards/roles.guard.ts` | Modify | Real role check vs `@Roles()`; deny-by-default; 403 on mismatch |
| `backend/src/auth/auth.module.ts` | Modify | `JwtModule` (`JWT_SECRET`, short expiry) + global `APP_GUARD`s |
| `backend/src/auth/scripts/issue-service-token.ts` | Create | Offline service-JWT issuance for rotation |
| `backend/src/devices/devices.controller.ts` | Modify | `@Roles('admin','viewer')` reads; `@Roles('admin')` mutations |
| `backend/src/actions/actions.controller.ts` | Modify | `@Roles('admin','service')` on `POST` |
| `backend/src/integrations/n8n/n8n.controller.ts` | Modify | `@Roles('service')`; delegate to `ActionsService.execute` (replaces 501) |
| `backend/src/health/health.controller.ts` + root | Modify | `@Public()` so global guards keep monitoring green |
| `frontend/app/api/devices/[deviceId]/actions/route.ts` | Modify | Forward `Authorization`; pass through status/body |
| `docs/integrations/n8n.md` | Modify | Issuance/rotation runbook |
| `backend/test/auth.e2e-spec.ts` + guard spec | Create | 401/403 matrix + guard unit tests |

## Interfaces / Contracts

```ts
interface JwtPayload { sub: string; role: Role; iat?: number; exp?: number; }
// Roles: devices reads (admin, viewer), mutations (admin),
// actions POST (admin, service), n8n dispatch (service)
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `RolesGuard` deny/match/mismatch/`@Public()`; `JwtAuthGuard` missing/malformed/expired → 401 | Guard specs, mocked `ExecutionContext` + `Reflector` |
| E2E | Full 401/403 matrix incl. service-executes/viewer-denied, expired → 401, proxy header forwarding | `test/auth.e2e-spec.ts` (supertest, `JwtService`-minted tokens, mocked ESP32 fetch) |
| CI | No regression | Token-attach updates to `app.e2e-spec.ts`; `JWT_SECRET` test env; backend `test`/`test:e2e`/`lint`/`build` + frontend `lint`/`build` green |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

1. Add `@nestjs/jwt` + `JWT_SECRET` to root `.env`, `backend/.env`, CI env; no Prisma migration.
2. Land guards + decorators in one PR (`develop` → `develop`, conventional commits, <400 lines); update existing e2e with tokens in the same PR.
3. Issue service JWT via CLI, store as n8n HTTP Header Auth credential via MCP; rotate by re-issuing. Rollback: `git revert` + rotate `JWT_SECRET`; keep endpoints unexposed until re-landed.

## Open Questions

- [ ] Service JWT TTL (proposed 24h — confirm vs 7d)?
- [ ] Viewer-gated dashboard action controls — tasks scope or deferred frontend change?

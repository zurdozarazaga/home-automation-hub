```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:0d337f19eea45197bebd3383573fd751041aa83d133c8aaa95e7a34223770795
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 8/8
scenarios: 12/12
test_command: npm run test -- --runInBand
test_exit_code: 0
test_output_hash: sha256:81bdc56286c4ef44e81ff7ee12314713941fa9cdf30f033f3f6a11b393ee50c1
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:c530be32e6194cb57a18a46cea4bf10887ed832e264462c5ebf427e5cd2f3731
```

## Verification Report

**Change**: auth-hardening
**Version**: N/A
**Mode**: Standard (strict_tdd false per `openspec/config.yaml`; STRICT TDD NOT ACTIVE)

Branch `feat/auth-hardening` at `90d42d9` (6 commits `694d38c`..`90d42d9`, pushed, no merge, no PR).
Attempt `verify-auth-hardening-001` (state proceed). Delivery `ask-on-risk` with
maintainer-approved `size:exception` for a single PR (hand-authored 665 lines
+575/-90 plus 133 generated lock lines vs 400 budget).

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 15 |
| Tasks complete | 15 |
| Tasks incomplete | 0 |

All tasks in `openspec/changes/auth-hardening/tasks.md` are checked `[x]`
(Phases 1-5). Engram `sdd/auth-hardening/tasks` and `apply-progress` agree
(15/15). No task is pending, so full verification proceeds (not blocked).

### Build & Tests Execution

Envelope test evidence is the backend unit suite; envelope build evidence is
the frontend production build (both exit 0, hashes of exact captured output).
Full per-project evidence follows; the two non-zero results are pre-existing
failures on clean `develop` (WARNING, not CRITICAL — see Issues).

**Tests**: backend unit ✅ 23 passed; backend e2e ⚠️ 13 passed / 1 pre-existing fail

```text
$ npm run test -- --runInBand (from backend/) → EXIT 0
Test Suites: 6 passed, 6 total
Tests:       23 passed, 23 total

$ npm run test:e2e (from backend/) → EXIT 1 (1 pre-existing failure, see WARNING W2)
Test Suites: 1 failed, 1 passed, 2 total
Tests:       1 failed, 13 passed, 14 total
FAIL test/app.e2e-spec.ts — AppController (e2e) › /devices/:id/actions (POST unreachable device -> 502)
  expected 502 "Bad Gateway", got 201 "Created" (app.e2e-spec.ts:187)

$ npm run test:cov (from backend/) → EXIT 0, 23/23 pass
All files | 32.86 % Stmts | 31.73 % Branch | 37.2 % Funcs | 32.95 % Lines
```

**Build**: frontend ✅ Passed; backend ❌ pre-existing failure (see WARNING W1)

```text
$ npm run build (from frontend/) → EXIT 0
✓ Compiled successfully; TypeScript finished; routes / and /api/devices/[deviceId]/actions built

$ npm run build (from backend/) → EXIT 1 (pre-existing, see WARNING W1)
Found 6 error(s), all in src/devices/repositories/prisma-device.repository.ts
(TS2345 nullable ipAddress/port vs device interface; file untouched by this change)

$ npm run lint (from backend/) → EXIT 0
$ npm run lint (from frontend/) → EXIT 0
```

**Coverage**: 32.86% statements / threshold: 0% (per `openspec/config.yaml`) → ✅ Above

### Spec Compliance Matrix

Spec source: `openspec/changes/auth-hardening/specs/auth-rbac/spec.md`
(8 `### Requirement:` headings, 12 `#### Scenario:` headings — authoritative
totals used for the envelope). Engram `sdd/auth-hardening/spec` is identical.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Service Role | Role set includes service | `roles.guard.spec.ts > allows a caller whose role matches @Roles()` + `jwt-auth.guard.spec.ts > sets request.user and allows valid token` | ✅ COMPLIANT |
| Service Credential Issuance and Rotation | Rotate compromised service token | `issue-service-token.spec.ts > mints a service token verifiable by JwtService` (new token succeeds) + `jwt-auth.guard.spec.ts > rejects invalid token with 401` (old token under rotated secret fails) + runbook `docs/integrations/n8n.md` | ✅ COMPLIANT |
| Service Credential Issuance and Rotation | Expired token rejected | `jwt-auth.guard.spec.ts > rejects expired token with 401` + `auth.e2e-spec.ts > rejects expired token with 401` | ✅ COMPLIANT |
| Deny-by-Default Enforcement | Unauthenticated device call rejected | `auth.e2e-spec.ts > rejects unauthenticated device call with 401` | ✅ COMPLIANT |
| Deny-by-Default Enforcement | Wrong role rejected | `roles.guard.spec.ts > denies viewer on service/admin route with 403` + `auth.e2e-spec.ts > rejects viewer device creation with 403` | ✅ COMPLIANT |
| Device Endpoint Authorization | Viewer cannot create devices | `auth.e2e-spec.ts > rejects viewer device creation with 403` | ✅ COMPLIANT |
| Device Endpoint Authorization | Service cannot manage devices | `auth.e2e-spec.ts > rejects service device management with 403` | ✅ COMPLIANT |
| Action Execution Authorization | Service executes action | `auth.e2e-spec.ts > lets service execute actions and blocks viewer` (service → 201) | ✅ COMPLIANT |
| Action Execution Authorization | Viewer cannot execute actions | `auth.e2e-spec.ts > lets service execute actions and blocks viewer` (viewer → 403, unauth → 401) | ✅ COMPLIANT |
| N8n Dispatch Authorization | Non-service caller rejected from dispatch | `auth.e2e-spec.ts > restricts n8n dispatch to the service role` (service → 201, viewer → 403, anon → 401) | ✅ COMPLIANT |
| Frontend Proxy Propagation | Proxy forwards credentials | Static verification (explicitly allowed: `openspec/config.yaml` declares frontend `test_command: none` — no test runner exists): `route.ts` forwards `authorization` unchanged + passes status/body through + no ESP32 import; frontend `lint` ✅ + `build` ✅ with route compiled | ✅ COMPLIANT |
| Auth Coverage | Matrix covered in CI | backend unit 23/23 pass + `auth.e2e-spec.ts` 7/7 pass (matrix tests all green; the single e2e failure is the unrelated pre-existing 502 case) | ✅ COMPLIANT |

**Compliance summary**: 12/12 scenarios compliant (11 runtime-proven; proxy statically proven under the project's explicit no-runner constraint)

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Service Role | ✅ Implemented | `Role = 'admin' \| 'viewer' \| 'service'`; distinct least-privilege scope |
| Service Credential Issuance and Rotation | ✅ Implemented | Offline CLI `issue-service-token.ts` (`sub=n8n-sistema-riego`, 24h TTL, refuses without `JWT_SECRET`); rotation = re-issue + `JWT_SECRET` rotation per runbook |
| Deny-by-Default Enforcement | ✅ Implemented | Global `APP_GUARD`s `JwtAuthGuard` (401) → `RolesGuard` (403); `RolesGuard` denies routes without `@Roles()` unless `@Public()` |
| Device Endpoint Authorization | ✅ Implemented | Reads `@Roles('admin','viewer')`, mutations `@Roles('admin')`; service excluded |
| Action Execution Authorization | ✅ Implemented | `POST /devices/:deviceId/actions` `@Roles('admin','service')` |
| N8n Dispatch Authorization | ✅ Implemented | `POST /integrations/n8n/actions` `@Roles('service')`, delegates to `ActionsService.execute` via `N8nTriggerActionDto` (501 placeholder + unused `N8nService` removed) |
| Frontend Proxy Propagation | ✅ Implemented | `route.ts` forwards `authorization` header unchanged, passes status/body through, no ESP32 import/call |
| Auth Coverage | ✅ Implemented | Guard unit specs (11 tests) + CLI spec (1) + `auth.e2e-spec.ts` (7) + admin-JWT updates to `app.e2e-spec.ts` |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Guard composition (`JwtAuthGuard` 401 + `RolesGuard` 403, global `APP_GUARD`, `@Public()` escape) | ✅ Yes | Implemented exactly; health + root `@Public()` keep monitoring green |
| JWT library (`@nestjs/jwt` `JwtService`, no Passport) | ✅ Yes | `JwtModule` 24h expiry; `JWT_SECRET` with test-only fallback, production has no default |
| Service issuance via offline CLI, revocation via short TTL + secret rotation | ✅ Yes | No HTTP issuance endpoint; runbook in `docs/integrations/n8n.md` |
| Least-privilege role matrix | ✅ Yes | Strict split per spec; service never manages devices; dispatch is service-exclusive |
| No schema change; no MQTT swap; no manual n8n.opi.ar edits | ✅ Yes | No prisma/schema/migration files changed; only MQTT mention in diff is a removed stale TODO line; n8n changes are backend delegation + docs runbook only |
| Deviations: `N8nService` deleted (not left unused); `n8n/README.md` rewritten to guarded dispatch; `JWT_SECRET` test fallback | ✅ Yes | Documented in apply-progress; each removes a stale contradiction of the new contract; no spec impact |

Scope-creep check: changed paths contain no `firmware/`, no relay/zone files,
no schema/migration changes, no MQTT logic. Out-of-scope items (deployment
target, rate limiting, relay/zones/firmware) untouched.

### Issues Found

**CRITICAL**: None

**WARNING**:
- W1 — Backend `npm run build` exits 1 with 6 TS errors, all in `src/devices/repositories/prisma-device.repository.ts` (nullable `ipAddress`/`port`). Pre-existing: the file is absent from this change's diff (`git diff develop...HEAD --name-only`), so the change adds zero new build errors. Proven on clean `develop` via stash per apply-progress §Issues. Out of scope; do not fail verify.
- W2 — `app.e2e-spec.ts` "unreachable device → 502" fails (expected 502, got 201). Pre-existing: the test mocks `fetch` rejection but the default in-memory ESP32 client never calls `fetch`, so the action returns 201 with or without this change (auth passes, hence 201 not 401/403 — the auth wiring itself works). Same signature with and without the change per apply-progress §Issues. Out of scope (fixing it means changing the 502 test strategy); do not fail verify.
- W3 — Proxy scenario has no runtime covering test because the project declares frontend `test_command: none (no test runner configured)` in `openspec/config.yaml`: no automated proxy test can exist, so static verification is the explicitly allowed evidence here (header-forwarding code inspected, no ESP32 import/call, frontend `lint` + `build` green with the route compiled). Recorded as warning for transparency, not a failure.

**SUGGESTION**:
- S1 — Consider a dedicated rotation-sequence test (token minted under secret A fails against secret B while a token minted under B succeeds) to make the rotation scenario self-contained instead of composition-covered.
- S2 — The pre-existing 502 e2e strategy (fetch-mock vs in-memory client) and the 6 prisma nullable-type build errors remain open outside auth scope; track as separate changes.
- S3 — PR size (665 hand-authored + 133 lock lines) exceeds the 400-line budget; land as a single PR under the maintainer-approved `size:exception` since the spec-mandated matrix coverage cannot shrink without dropping required scenarios.

### Verdict

PASS WITH WARNINGS — 15/15 tasks complete, 8/8 requirements implemented, 12/12 scenarios compliant (11 runtime-proven plus proxy statically proven under the project's explicit frontend no-runner constraint); the only failing checks are two identical pre-existing failures from clean `develop`. No scope creep. Ready for archive and single-PR delivery under the approved `size:exception`.

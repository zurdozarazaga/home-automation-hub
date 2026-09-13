# Archive Report: Auth Hardening

**Change**: `auth-hardening`
**Archived to**: `openspec/changes/archive/2026-09-13-auth-hardening/`
**Archive date**: 2026-09-13
**Mode**: hybrid (`both` — filesystem + Engram)
**Delivery strategy**: `exception-ok` for this run (maintainer explicitly accepted `size:exception` after `ask-on-risk` stopped to ask)
**Status at close**: SDD cycle complete — proposed, specified, designed, implemented (15/15 tasks), verified (`pass_with_warnings`, 0 blockers, 0 critical). Code committed on `feat/auth-hardening`, NOT merged. No PR opened yet.

## Final-State Authority

This report describes the change AT CLOSE. Per the archive hierarchy, the persisted
`tasks` artifact and the orchestrator's explicit final-state facts outrank the
intermediate `apply-progress` / `verify-report` snapshots. Snapshot-derived claims
below are attributed to their source and time; bare present-tense statements are
final state.

Engram observations read (full content via `mem_get_observation`):

| Artifact | Observation ID | State |
|----------|---------------|-------|
| `sdd/auth-hardening/proposal` | #606 | matches `proposal.md` |
| `sdd/auth-hardening/spec` | #607 | identical to delta spec (8 requirements, 12 scenarios) |
| `sdd/auth-hardening/design` | #608 | summary pointer to `design.md` |
| `sdd/auth-hardening/tasks` | #609 | agrees 15/15 complete |
| `sdd/auth-hardening/apply-progress` | #610 | agrees 15/15 complete |
| `sdd/auth-hardening/verify-report` | #611 | verdict `pass_with_warnings`, 8/8 req, 12/12 scenarios |

## Task Completion Gate

`tasks.md`: 15/15 checked (`- [x]`), 0 unchecked implementation tasks. Gate passes;
no stale-checkbox reconciliation was needed. (Unchecked `- [ ]` lines elsewhere are
planning statements only: proposal success criteria and design open questions —
TTL default resolved to 24h during apply, viewer-gated dashboard controls deferred
per tasks assumption. Neither is an implementation task.)

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `auth-rbac` | Created | 8 requirements added, 12 scenarios; 0 modified, 0 removed |

No main spec existed (`openspec/specs/` held only `device-driver`,
`device-transport`, `telemetry-ingest`), so the delta spec was copied mechanically
as the full spec to `openspec/specs/auth-rbac/spec.md`. Purely additive merge —
`rules.archive` ("warn before merging destructive deltas") does not trigger; no
existing requirement was touched.

Mechanical evidence (Step 2): shell `cp` to temp path + `diff -r` source vs temp
returned empty (no differences), then `mv` to `openspec/specs/auth-rbac/spec.md`.
Post-move readback `diff -r openspec/specs/auth-rbac/spec.md
openspec/changes/archive/2026-09-13-auth-hardening/specs/auth-rbac/spec.md`
returned empty (`SPEC_SYNC_IDENTICAL`).

## Archive Contents

- `proposal.md` (66 lines) ✅
- `specs/auth-rbac/spec.md` (111 lines) ✅
- `design.md` (106 lines) ✅
- `tasks.md` (56 lines, 15/15 complete) ✅
- `apply-progress.md` (119 lines) ✅
- `verify-report.md` (147 lines) ✅
- `archive-report.md` (this file, additive-only) ✅

Mechanical evidence (Step 3): `git mv` refused the folder (`fatal: source
directory is empty`) because the SDD trail is untracked by design (repo
chore-commit practice — code commits and SDD-trail commits stay separate). Per the
skill's fallback path, source was confirmed byte-identical to the pre-move
snapshot (`diff -r` empty), then plain `mv` moved it, source confirmed gone, and
the mandatory `diff -r` snapshot-vs-destination readback returned empty. Active
`openspec/changes/` no longer contains `auth-hardening`. Line counts of all
archived files match their pre-move values exactly.

## Source of Truth Updated

- `openspec/specs/auth-rbac/spec.md` (new) — JWT + RBAC contract including the
  least-privilege `service` role, deny-by-default 401/403 semantics, per-endpoint
  role matrix, proxy header-forwarding, and CI matrix coverage.

## Final State at Close

- **Branch**: `feat/auth-hardening` at `90d42d9`; 6 work-unit commits
  `694d38c`..`90d42d9`, pushed, no merge, no PR opened. Verify made zero code
  changes, so no commits exist after `verify-report`.
- **Tests (final)**: backend unit 6 suites / 23 tests pass (auth 12); backend e2e
  13/14 (1 pre-existing failure); backend + frontend `lint` clean; frontend
  `build` clean.
- **Verify warnings (only open items, all pre-existing or transparency-only)**:
  1. Backend `build` 6 TS errors in `prisma-device.repository.ts` — identical on
     clean `develop` via stash, file untouched by this change. Track as a
     separate change; do not reopen here.
  2. `app.e2e` 502 fetch-mock mismatch — identical on clean `develop`
     (in-memory ESP32 client never calls `fetch`). Track as a separate change;
     do not reopen here.
  3. Proxy header-forwarding statically verified (no frontend test runner exists
     per `openspec/config.yaml`) with `lint` + `build` green. Transparency-only.
- **Size**: `size:exception` maintainer-approved single PR to `develop`
  (665 hand-authored +575/-90 lines plus 133 lock lines vs 400 budget). Do NOT
  merge — a human merges after review per ordinary repo policy.
- **SDD trail**: `openspec/changes/auth-hardening/` (proposal, design, spec,
  tasks, apply-progress, verify-report) left uncommitted per repo chore-commit
  practice; code is committed on `feat/auth-hardening`. This archive move
  preserves that separation (trail still uncommitted, now under
  `openspec/changes/archive/`).
- **Boundaries kept**: no manual edits in n8n.opi.ar (forbidden; MQTT swap via
  MCP is follow-up change `n8n-e2e`); no schema change; no MQTT logic;
  deployment target still deferred (frontend/backend not deployed).

## Next

PR creation follows after archive per gitflow: branch from `develop`, single PR
to `develop`, conventional commits, no `Co-Authored-By`, CI Backend/Frontend
green required. No further SDD phase is recommended for this change.

## Risks

- Pre-existing backend build errors (prisma nullable types) and the stale 502 e2e
  strategy remain open outside auth scope; if left untracked they will keep
  failing CI for every subsequent change. Mitigation: file them as separate
  changes (verify S2 already recommends this).
- Service-token leak blast radius is bounded by 24h TTL + `JWT_SECRET` rotation
  runbook, but there is no automated rotation-sequence test (verify S1). A
  follow-up test would make the rotation scenario self-contained.

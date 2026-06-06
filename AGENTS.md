# AGENTS.md

Reference for AI agents working in this repo. See also `.github/copilot-instructions.md` for the full constraint set.

---

## Repo layout

```
backend/    NestJS API (port 3001)
frontend/   Next.js app (port 3000)
firmware/   Empty – ESP32 code not yet here
```

No monorepo tooling. Each package has its own `node_modules` and `package.json`. Run commands from within `backend/` or `frontend/`.

---

## Dev environment

Local dev runs entirely in Docker. There is no supported path for running services directly on the host against a local DB.

```bash
# Start everything (postgres + backend + backend:dev + frontend:dev)
docker compose -f docker-compose.local.yml up

# Rebuild after dependency changes
docker compose -f docker-compose.local.yml up --build
```

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:3000`
- Postgres: `localhost:5432`

The backend container runs `npm install && npx prisma generate && npx prisma migrate deploy && npm run start:dev` on startup — migrations run automatically in local mode.

---

## Environment variables

Root `.env` is loaded by Docker Compose. Backend reads its own `backend/.env` for local-only overrides (currently only `PORT=3001`).

| Variable | Values | Effect |
|---|---|---|
| `DATA_SOURCE` | `in-memory` \| `prisma` | Switches repository and ESP32 client implementations |
| `DATABASE_URL` | postgres URL | Required when `DATA_SOURCE=prisma` |
| `NEXT_PUBLIC_API_BASE_URL` | URL | Frontend → Backend base URL |

**`DATA_SOURCE=in-memory` (default):** uses fake in-memory repositories and a fake ESP32 client. No DB or physical device needed.  
**`DATA_SOURCE=prisma`:** uses real Postgres and real HTTP calls to ESP32 devices.

---

## Backend commands (run from `backend/`)

```bash
npm run start:dev        # watch mode
npm run build            # compile to dist/
npm run lint             # eslint --fix
npm run format           # prettier --write
npm run test             # jest (unit, *.spec.ts in src/)
npm run test:e2e         # jest --config ./test/jest-e2e.json
npm run test:cov         # coverage

npm run prisma:generate       # after schema changes
npm run prisma:migrate:dev    # create + apply migration (dev)
npm run prisma:migrate:deploy # apply existing migrations (prod/CI)
```

After changing `prisma/schema.prisma` you must run `prisma:generate` before the TypeScript build will pass.

---

## Frontend commands (run from `frontend/`)

```bash
npm run dev    # Next.js dev server
npm run build  # production build
npm run lint   # eslint
```

No test runner configured in the frontend yet.

---

## Architecture constraints (enforced)

1. **No business logic on ESP32.** ESP32 is a physical executor only (turn on/off, report status).
2. **Frontend never calls ESP32 directly.** All communication: `Frontend → Backend → ESP32`.
3. **Controllers must be thin.** Business logic lives in Services; DB access is isolated in Repositories.
4. **All Prisma calls must be wrapped in try/catch.** On failure: log with context, throw `HttpException`. Never let raw Prisma errors reach the controller.
5. **ESP32 unreachable = HTTP 502.** Backend must return `BadGatewayException`, log device ID + timestamp, never swallow the error silently.
6. **Constraint priority:** Security > Architecture Principles > Backend Standards > API Standards > Code Quality > Future Compatibility.

---

## Repository / DI pattern

Both `DevicesModule` and `ActionsModule` switch implementations at startup via `process.env.DATA_SOURCE`:

- Repositories: `InMemory*Repository` vs `Prisma*Repository`
- ESP32 client: `InMemoryEsp32ClientService` vs `Esp32HttpClientService`

Injection tokens are in `src/devices/constants/device-repository.token.ts` and `src/actions/constants/`.  
`DatabaseModule` is `@Global()` — `PrismaService` is available everywhere without re-importing.

---

## Backend module structure

```
src/
  app.module.ts         root — imports Database, Devices, Actions, Health, Auth
  setup-app.ts          global ValidationPipe (whitelist, forbidNonWhitelisted, transform) + HttpExceptionFilter
  database/             PrismaService (global)
  devices/              CRUD for Device model
  actions/              Execute action on a device; logs result to ActionLog
  auth/                 JWT + RolesGuard (admin / viewer)
  health/               health-check endpoint
  common/filters/       HttpExceptionFilter
```

---

## Prisma schema models

`Device`, `Relay`, `ActionLog` — all use UUID PKs, snake_case DB column names via `@map`.  
`Device.name` is unique. `(ipAddress, port)` pair is unique.  
`Relay` and `ActionLog` cascade-delete when their parent `Device` is deleted.

---

## Frontend structure

- Next.js App Router (`app/`), Server Components by default.
- Use Client Components only when browser APIs, event handlers, or React hooks are required.
- Keep components under 150 lines; extract repeated logic/UI into shared components.
- Feature-based folder organization.
- UI: dark mode only, TailwindCSS v4, shadcn/ui, mobile-first.

---

## Future integration stubs

MQTT and WebSocket integration points are scaffolded with `TODO` comments in `actions.service.ts` — do not implement logic, only scaffold and document with TODOs referencing the future integration.

---

## n8n integration

Workflow activo: `sistema_riego_automatizado` (ID `heJzDDe5HCCz7Xuy`) en
`https://n8n.opi.ar/`. Se gestiona **vía MCP** (`mcp_n8n-mcp_n8n_*`).
Detalle operativo, troubleshooting y comandos MCP en
[`docs/integrations/n8n.md`](docs/integrations/n8n.md).

**Regla arquitectónica:** n8n es un *trigger source*, no un controlador de
dispositivos. n8n **nunca publica directo a MQTT/ESP32**. El flujo correcto es:

```
n8n (decide: clima / schedule / telegram) → POST backend /devices/:id/actions → Backend → ESP32
```

n8n decide, el backend ejecuta y audita (`ActionLog`), el ESP32 solo
ejecuta el comando físico.

- Endpoint que n8n invoca: `POST /devices/:deviceId/actions`
- Body: `{ "action": "turn_on" | "turn_off", "target": "riego" | "luces" }`
- Auth: JWT con rol `service` (cuenta de servicio dedicada, no `admin`)
- 502 = ESP32 caído; el `ActionLog` queda con `result: "failed"`. No
  reintentar agresivamente.

**No editar el workflow en n8n.opi.ar salvo vía MCP.** Validar con
`mcp_n8n-mcp_n8n_validate_workflow` antes de activar.

---

## Production deploy

```bash
docker compose -f docker-compose.prod.yml up --build
```

Prod uses `Dockerfile` builds in `backend/` and `frontend/`. Secrets must come from environment — never hardcoded.

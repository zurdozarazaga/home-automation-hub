# Docker Compose Strategy

## Recommended approach

Use one compose setup per environment from repository root:

- Local development: `docker-compose.local.yml`
- Production-like: `docker-compose.prod.yml`

This keeps frontend, backend, and database orchestrated together and avoids service drift.

## Why not two completely separate compose projects?

A split setup (one compose for frontend and another for backend/database) is useful only for very large teams with strict ownership boundaries.
For this project, a unified stack is simpler and safer:

- One network and service discovery model
- One startup command
- Fewer environment mismatches

## Local run

```bash
docker compose -f docker-compose.local.yml up -d
```

Default local behavior:

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Postgres: localhost:5432
- Data source strategy: `DATA_SOURCE=in-memory` unless overridden (fake repositories and fake ESP32 transport, no DB or board needed)

### Environment file

Docker Compose reads the root `.env` automatically. Start from the template:

```bash
cp .env.example .env
```

| Variable | Local default | Effect |
|---|---|---|
| `DATA_SOURCE` | `in-memory` | `in-memory` uses fakes; `prisma` uses Postgres and real HTTP calls to the board |
| `DATABASE_URL` | `postgresql://postgres:postgres@postgres:5432/home_automation_hub` | Host must be `postgres` for containers. Host-run commands (e2e, scripts) override it with `localhost` |
| `AUTH_USERNAME` | `admin` | Login username |
| `AUTH_PASSWORD` | `admin` (compose local default) | Login password. If unset the login endpoint answers 503 and logs `login disabled: AUTH_PASSWORD not set` |
| `JWT_SECRET` | `local-dev-jwt-secret` | Signs and validates every JWT (login, CLI tokens, n8n). All issuers/verifiers must share it; prod MUST set a real random value |
| `DEVICE_POLL_INTERVAL_MS` | `30000` | Device status/telemetry poller interval in ms; `<= 0` disables it |
| `ESP32_HTTP_TIMEOUT_MS` | `5000` | Timeout for backend -> ESP32 HTTP calls (commands and `GET /estado`) |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3001` | Frontend -> backend base URL |

## Prisma mode (real database + board)

Use this mode to test with the physical ESP32. Set in `.env`:

```bash
DATA_SOURCE=prisma
```

and start the stack:

```bash
docker compose -f docker-compose.local.yml up -d --build
```

The backend container runs `prisma generate` and `prisma migrate deploy` on startup, so the schema is applied before the app boots. With `DATA_SOURCE=prisma`:

- Repositories use Postgres (devices, action logs, telemetry).
- Device actions are delivered over HTTP to `http://{ipAddress}:{port}`.
- The monitoring poller pulls `GET /estado` from every `esp32` device that has an IP and port: reachable -> `status=online`, unreachable -> `status=offline`, and a valid DHT22 snapshot is ingested as telemetry (`temperature`/`humidity`).

### Register the board

```bash
docker compose -f docker-compose.local.yml exec backend \
  npm run devices:register -- \
  --name "riego-patio" --ip 192.168.1.50 --port 80 --description "ESP32 riego y luces"
```

The script upserts by name: re-running it with a new `--ip` re-points the same device (driver stays `esp32`). From the host, prefix the command with `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/home_automation_hub`.

## Login and tokens

`POST /auth/login` is public; every other route needs a `Bearer` token.

```bash
TOKEN=$(curl -s http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' | jq -r .accessToken)

curl -s http://localhost:3001/devices -H "Authorization: Bearer $TOKEN"
```

Offline issuance (must use the same `JWT_SECRET` as the backend):

```bash
# inside the container
docker compose -f docker-compose.local.yml exec backend npm run auth:issue-token -- --role admin

# from the host (backend/)
JWT_SECRET=local-dev-jwt-secret npm run auth:issue-token -- --role viewer
```

`npm run auth:issue-service` stays as the service-token alias used by the n8n integration.

## Backend e2e against local Postgres

The e2e suite is green only with the Prisma datasource and a migrated database:

```bash
docker compose -f docker-compose.local.yml up -d postgres

cd backend
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/home_automation_hub npx prisma migrate deploy
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/home_automation_hub \
  DATA_SOURCE=prisma AUTH_PASSWORD=ci-pass npm run test:e2e
```

## Production-like run

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This builds both app images and runs Postgres + Backend + Frontend in one stack. Production secrets (`JWT_SECRET`, `AUTH_PASSWORD`, database credentials) must come from the environment, never from committed files.

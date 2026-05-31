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
- Data source strategy: `DATA_SOURCE=in-memory` unless overridden

To test Prisma mode locally:

```bash
DATA_SOURCE=prisma docker compose -f docker-compose.local.yml up -d
```

## Production-like run

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This builds both app images and runs Postgres + Backend + Frontend in one stack.

## Notes

- Current Prisma repositories are placeholders; keep `DATA_SOURCE=in-memory` until Prisma repository implementation is completed.
- Compose files are ready so switching later is mostly an environment change.

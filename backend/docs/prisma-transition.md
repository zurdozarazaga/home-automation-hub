# Prisma Transition Guide

This backend currently runs with in-memory repositories by default.
The repository contracts are stable and already support switching to Prisma.

## 1. Environment

Set the following values in `.env`:

- `DATA_SOURCE=prisma`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/home_automation_hub`

Use `DATA_SOURCE=in-memory` while Prisma repositories are still placeholders.

## 2. Prisma schema

Base schema is located at:

- `prisma/schema.prisma`

Included models:

- `Device`
- `Relay`
- `ActionLog`

## 3. Commands

From backend root:

```bash
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
```

## 4. Repository switch points

Device repository selector:

- `src/devices/devices.module.ts`

Action log repository selector:

- `src/actions/actions.module.ts`

Both selectors use `process.env.DATA_SOURCE` and support:

- `in-memory`
- `prisma`

## 5. Pending implementation

The following classes are placeholders and intentionally throw `NotImplementedException`:

- `src/devices/repositories/prisma-device.repository.ts`
- `src/actions/repositories/prisma-action-log.repository.ts`

Implement these repositories with Prisma queries and keep the existing interfaces unchanged:

- `DeviceRepository`
- `ActionLogRepository`

This will allow a transparent migration with no controller/service contract changes.

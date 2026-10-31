# Feature: despliegue al VPS prestado (Portainer, GHCR)

## Objective

Levantar frontend + backend + postgres en un stack nuevo del VPS
prestado vía Portainer, sin interferir con los 14 stacks existentes,
y hacer el cutover del enlace (push) + n8n.

## Contexto verificado (solo lectura, 2026-10-30)

- Portainer CE 2.39.2, 1 nodo swarm (`opi`, manager, x86_64, 2 CPU, 8 GB).
- Traefik v2.11 con redirect global HTTP→HTTPS: lo público es solo HTTPS
  por subdominio. La placa solo habla HTTP plano → backend por puerto
  host directo, sin Traefik.
- Puertos host libres verificados: 3000/3001/3101. Se usa 3101 backend
  (mismo que en local) y 3000 frontend.
- IP pública: 69.62.93.9.
- Repo público, default branch `main`; imágenes a GHCR público.
- La compose prod actual NO sirve en swarm: usa `build:` (stack deploy
  no buildea), `container_name`, sin `deploy:`, sin envs de auth/link
  mode, frontend con `NEXT_PUBLIC_*` en vez de `API_BASE_URL` runtime,
  y nada corre `prisma migrate deploy`.

## Scope

- Nuevo `docker-compose.portainer.yml`: imágenes GHCR pineadas,
  sin `build:`/`container_name`, con `deploy:` (replicas 1, placement
  manager, límites de memoria), red y volumen propios (`hah-*`),
  envs por variables (JWT_SECRET, AUTH_*, DEVICE_LINK_MODE=push,
  DATABASE_URL, API_BASE_URL=http://backend:3001), solo publica
  3101:3001 y 3000:3000.
- Workflow/gh: buildx `--platform linux/amd64` + push a GHCR
  (consentimiento explícito del usuario antes del push).
- Stack en Portainer vía API (swarm file stack + env), red propia,
  `prisma migrate deploy` una vez por consola, verificación `/health`.
- Cutover: JWT service del VPS, provision placa (HUB_URL+HUB_TOKEN,
  acción física del usuario), registro MAC, URL n8n → VPS (acción UI
  del usuario), prueba E2E, retiro de túnel/stack local como rollback.
- Docs: actualizar `docs/` con el wiring del VPS.

## Out of scope

- Subdominio HTTPS propio (requiere al dueño: DNS + labels Traefik).
  n8n y humanos usan `http://69.62.93.9:3101|3000`; JWT viaja en claro
  en ese tramo (aceptado para fase de pruebas, token rotado).
- Tocar los 14 stacks existentes, GitOps automático (redeploy manual).
- Persistencia del timer de auto-off ante restart (deuda ya registrada).

## Constraints

- push-guard: ningún `docker push`, PR o merge sin consentimiento
  explícito para esa acción exacta.
- Secrets solo como env vars del stack; nunca commitear ni loguear.
- Mutaciones en el VPS solo las autorizadas (crear stack propio,
  migrate, deploy); nada sobre stacks ajenos.

## Tasks

- [x] T1 — `docker-compose.portainer.yml` swarm-ready. Checks: `docker compose config` válido (warnings de `deploy` esperados fuera de swarm).
- [ ] T2 — Build local `linux/amd64` backend+frontend (sin push). Checks: imágenes corren local (`docker run` health).
- [ ] T3 — Push a GHCR (REQUIERE consentimiento). Checks: pulls visibles en ghcr.io.
- [x] T4 — Stack `hah` creado en Portainer (Id 43) vía API: 3 servicios running con imágenes GHCR, migrate deploy 4/4 por exec, `/health` OK en `http://69.62.93.9:3101`, device `riego-patio` registrado por MAC (offline hasta primer sync).
- [x] T5 parcial — VPS verificado sin n8n: turn_on durationMinutes:1 → queued → placa ejecutó on (ack) y auto-off a los 60 s (ActionLog success/success), relés en off. Placa online por push. Falta: ejecución manual del workflow n8n (edición del usuario) + retiro del túnel.
- [ ] T6 — Commit + push + PR (REQUIERE consentimiento), merge solo CI verde + autorización.

## Route

Parent inline (un cambio entendido por tarea); writer solo si aparece
motivo (unidades paralelas o backstop). Test-first no aplica (infra);
verificación = comandos observados por tarea.

## Log

- 2026-10-30: T1 hecha (compose válida). T2 parcial (backend amd64 OK;
  frontend imposible local por segfault QEMU en next build/SWC).
- 2026-10-30: creado `.github/workflows/publish-images.yml` (patrón de
  la casa: runners amd64 + GHCR + cache gha). Requiere estar en `main`
  para correrse.
- 2026-10-30: PR #28 mergeado a develop; PR #29 develop→main abierto y
  renombrado (trae toda la historia, main estaba meses atrás).
- 2026-10-30: Firmware CI en rojo por `pip install -U pioarduino`
  (6.2.0.post1 incompatible con plataforma 55.03.312). Fix en
  PR #30 (pin `pioarduino<6.2.0`). No causado por nuestros cambios.

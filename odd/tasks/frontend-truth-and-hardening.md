# Feature: dashboard veraz + hardening del login

Objetivo: que el dashboard muestre solo datos reales (telemetría, liveness, capacidades)
y que el login sea defendible en un host público. Branch: `feat/frontend-truth-and-hardening`.
Delivery: `ask-on-risk`. Runners: backend `npm run test` + `npm run test:e2e` + `npm run build`
(jest); frontend sin runner → `npm run lint` + `npm run build` (excepción documentada).

## Specs

S1 — Login con una sola cuenta por entorno (`AUTH_USERNAME`/`AUTH_PASSWORD`), sin user store.
Debe limitar intentos fallidos: 5 por usuario en 15 min y 20 globales en 15 min; al excederse
responder **429** genérico. Un login exitoso resetea el contador del usuario. Nunca loguear
credenciales ni el usuario intentado.

S2 — Cookie de sesión endurecida sobre HTTPS: nombre `__Host-hub_token`, `Secure`,
`SameSite=Strict`, `Path=/`, sin `Domain`, `maxAge` = `expiresIn` del backend. Sobre HTTP
(local) usar `hub_token` sin `Secure`. Logout debe borrar ambos nombres. Lectura de sesión
debe aceptar ambos nombres. Detección de esquema: `x-forwarded-proto` (Traefik termina TLS)
con fallback al protocolo de la request.

S3 — La tarjeta de sensores debe mostrar la **última** lectura real. La consulta de
telemetría debe acotar la ventana (`from` = ahora − 10 min, `limit` 1000) porque el backend
ordena `ts asc` y con `limit=500` sobre 24 h devuelve filas de hace ~24 h.

S4 — Las zonas se derivan de `device.capabilities` (`["riego","luces"]`), no de keywords
sobre nombre/descripción. Si ningún device declara la capacidad, la tarjeta queda
deshabilitada con un mensaje honesto.

S5 — Prohibido mostrar datos inventados: se eliminan la actividad mock, el horario/estado
de automatización mock (07:00/Activo; el real es n8n 06:00) y el panel "Future ready". Si no
hay dato, se muestra un estado vacío honesto.

S6 — "Encender" sobre `riego` debe enviar `durationMinutes: 15` para no dejar riego sin
auto-off. El mensaje debe distinguir `202` (en cola, la placa aplica en segundos) de `201`
(ejecutado).

S7 — La lista de dispositivos muestra `lastSeenAt` relativo ("visto hace X") y las
capacidades; es la señal de vida real en modo push.

S8 — Headers de seguridad: `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`
(sin `includeSubDomains`). En backend: `nosniff`, `DENY`, `no-referrer` sin dependencias
nuevas (no helmet).

S9 — El dashboard se refresca solo cada ≤30 s (Server Component + `router.refresh()`).

S10 — El clima del header (OpenWeatherMap) queda para la tarea T4: requiere
`OPENWEATHER_API_KEY` en el stack. Mientras no exista, el header muestra temperatura real
del DHT22 y "—" donde iría el clima.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
| --- | --- | --- | --- | --- |
| T1 | S1, S8(backend), +TTL 12h | delegated (writer backend) | done | 23 suites / 158 tests; build+lint green; e2e 4 fallos por `DATABASE_URL` ausente, idénticos en base |
| T2 | S2(frontend), S3-S9 | delegated (writer frontend) | done | lint+build green; smoke HTTP de cookies `__Host-`, Origin 403, telemetría 10 min, `durationMinutes: 15` |
| T3 | verificación + deploy | inline | code done / deploy pending | requiere commit+push y `publish-images.yml` (consentimiento) |
| T4 | S10 (weather endpoint + header) | inline | done | 9 tests nuevos (cache, stale, 503, overrides); backend 167/167 + build; frontend lint+build |

## Log

L1 (2026-10-31, verbatim): "Hemos desplegado todo en el vps y esta funcionando el flujo de n8n.
Lo que debemos verificar y entiendo que debemos modificar es el frontend porque no se si se
activa la placa mediante el frontend y aparte hay algunas cosas que estan mockeadas como la
temperatura que muesta. Analizemos que debemos modificar del frontend. Para eso puedes ver lo
que se hizo en las ramas y en engram"

L2 (2026-10-31, verbatim): "En la etapa 1 dedemos tener en cuenta de ver si el login es uno
robusto y cumple con las buenas practicas de ciberseguridad aparte de solucionar el tema de la
cookie. En cuanto al header de la temperatura podriamos utilizar openweathermap que ya lo
utilizamos en n8n con las credenciales para obtener la temperatura de la ciudad donde estamos
( podriamos utilizar geolocalizacion) y mostrarlo. Entiendo que esto saldria del plan de
implementacion y de la etapa 1. Si quieres puedes volver a planificarlo y ver si es conveniente
implementarlo asi"

L3 (2026-11-01, verbatim): "algo a tener en cuenta es que todavia no conecte la placa al riego y
no tiene reles todavia por lo que no hay riesgos. Dicho esto quieres que empecemos con las
modificacioens?"

L4 (2026-11-01): TLS cerrado y verificado — `https://hub.ezarazaga.ar` con Let's Encrypt,
resolver `le` HTTP-01, network `traefik_public`, `deploy.labels` en el servicio `frontend`.
Login funciona. `ActionLog` probado en producción: `turn_on|riego|success|200` y
`turn_off|riego|success|200`; fallos offline con 502 y motivo. Placa sin relés físicos todavía.

L5 (2026-11-01): arranca implementación de T1 y T2 en paralelo (superficies disjuntas:
`backend/src/auth+setup-app` vs `frontend/**`). Sin dependencias nuevas en ninguno de los dos.

L6 (2026-11-01): T1 y T2 implementados. Backend: throttle 5/usuario + 20 global por 15 min
(429 genérico), orden 503 → throttle → comparación timing-safe → record/reset, TTL 12 h,
`enforceProductionSecrets()` (solo producción; `JWT_SECRET` ausente corta el boot, débil
solo advierte), headers `nosniff`/`DENY`/`no-referrer` sin helmet. Frontend: cookie
`__Host-hub_token` sobre HTTPS con `SameSite=Strict` (migración transparente desde
`hub_token`), Origin guard en login/logout/actions, telemetría con ventana de 10 min,
zonas por `capabilities`, fuera mocks de actividad/automatización/future-ready, estado de
zona desconocido hasta enviar un comando (etiqueta "Último comando"), riego con
`durationMinutes: 15`, liveness por `lastSeenAt` con fallback a `status`, auto-refresh 20 s,
headers de seguridad + HSTS sin `includeSubDomains`, `noindex`.
Verificación del padre: `backend npm run test` 158/158, `backend npm run build` OK,
`frontend npm run lint` OK, `frontend npm run build` OK, sin referencias colgadas a
componentes borrados. Correcciones del padre sobre el trabajo delegado: regla de liveness
(`lastSeenAt` manda; `status` solo si no hay timestamp), Origin guard en logout, 429 en el
formulario de login, `docker-compose.prod.yml` con `JWT_SECRET`/`AUTH_PASSWORD` requeridos
(el fail-fast lo hubiera dejado en crash-loop), limpieza del scratch `var/` dentro del repo.
Pendiente: deploy (commit+push+workflow+stack) y T4 (key de OpenWeatherMap).

L7 (2026-11-01): T4 implementado. Backend `weather/`: `GET /weather` con `@Roles('admin','viewer')`,
`data/2.5/weather` (free tier, no One Call), `WEATHER_LAT/LON/CITY` con defaults de Río Cuarto,
cache 10 min, timeout 5 s con `AbortController`, y política de fallo: snapshot viejo si existe,
503 si no. La key nunca se loguea ni aparece en errores. Frontend: `getDashboardData` pide
`/weather` en paralelo con la telemetría y el header muestra clima exterior + `statusLine`;
sin clima muestra "—" + "Clima no disponible" sin romper el dashboard. El DHT22 queda solo en
la tarjeta de sensores (dos fuentes distintas, no se mezclan).
Verificación: `npx jest src/weather` 9/9; `npm run test` 24 suites / 167 tests; `npm run build`
OK; `frontend npm run lint` OK; `npm run build` OK.
Desviación de proceso: T4 se implementó antes de escribir los tests, así que no hubo RED
observado (el módulo es nuevo y no había comportamiento previo que preservar).

L8 (2026-11-01): prueba real contra OpenWeatherMap OK. Backend local en :3102 con
`DATA_SOURCE=in-memory` y la key leída del `.env` raíz sin imprimirla:
`GET /weather` → `{"location":"Río Cuarto","temperatureC":25.9,"description":"lluvia moderada",
"icon":"10d","humidityPct":38,"fetchedAt":"2026-11-01T21:51:33.164Z"}`. Sin token → 401.
Confirmado `lang=es` (descripción en español) y el contrato real (`main.temp`,
`weather[0].description`) coincide con el que asumen los tests. Proceso local terminado y
scratch eliminado.

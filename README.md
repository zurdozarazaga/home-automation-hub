# Home Automation Hub

Sistema de automatización doméstica basado en ESP32, Next.js, NestJS y PostgreSQL.

## Estado del Proyecto

- Monorepo inicializado con frontend y backend funcionales.
- Flujo recomendado: cambios en ramas cortas + Pull Request hacia `main`.
- CI configurado para validar frontend y backend en cada PR.

## Objetivo

Permitir el control y monitoreo centralizado de dispositivos domésticos como:

- Riego automático
- Luces
- Sensores ambientales
- Relés
- Dispositivos IoT futuros

El sistema debe permitir:

- Control manual desde interfaz web
- Automatizaciones programadas
- Integración con n8n
- Monitoreo de estado en tiempo real
- Gestión de múltiples dispositivos ESP32

---

## Estructura del Monorepo

```text
.
├── backend/    # API REST (NestJS + Prisma)
├── frontend/   # Web app (Next.js App Router)
├── firmware/   # Código para ESP32
├── docs/       # Documentación funcional y técnica
└── .github/    # Workflows y configuración de repo
```

---

## Arquitectura

```text
Frontend (Next.js)
        ↓
Backend API (NestJS)
        ↓
PostgreSQL

Backend API
        ↓
ESP32 Devices

n8n
        ↓
Backend API
```

## Requisitos Previos

- Node.js 22 LTS
- npm 10+
- PostgreSQL 16+
- Git 2.40+

### Responsabilidades

#### Frontend

- Dashboard
- Gestión de dispositivos
- Gestión de acciones
- Visualización de estados
- Autenticación

#### Backend

- API REST
- Autenticación
- Persistencia
- Auditoría
- Comunicación con dispositivos ESP32

#### ESP32

- Exponer endpoints HTTP
- Ejecutar acciones físicas
- Reportar estado
- Aplicar protecciones locales

#### n8n

- Automatizaciones
- Reglas de negocio
- Integraciones externas
- Clima
- Notificaciones

---

## Principios

- El ESP32 no contiene lógica de negocio.
- Las decisiones se toman en n8n o en el backend.
- El ESP32 solamente ejecuta acciones físicas.
- Todo dispositivo debe ser registrable dinámicamente.
- El sistema debe soportar múltiples ESP32.

---

## Tecnologías

### Frontend

- Next.js
- TypeScript
- TailwindCSS
- shadcn/ui

### Backend

- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM

### IoT

- ESP32
- HTTP REST

### Automatización

- n8n

---

## Puesta en Marcha Local

### 1. Instalar dependencias

```bash
cd backend && npm ci
cd ../frontend && npm ci
cd ..
```

### 2. Variables de entorno

Crear los archivos `.env` para backend y frontend según necesidades del entorno.

Sugerido:

- `backend/.env`: conexión a PostgreSQL, JWT secret, puertos.
- `frontend/.env.local`: URL de backend y variables públicas de frontend.

### 3. Levantar backend

```bash
cd backend
npm run start:dev
```

### 4. Levantar frontend

```bash
cd frontend
npm run dev
```

---

## Scripts Útiles

### Backend

- `npm run start:dev` desarrollo
- `npm run lint` linting
- `npm test` unit tests
- `npm run build` build producción

### Frontend

- `npm run dev` desarrollo
- `npm run lint` linting
- `npm run build` build producción

---

## Workflow de Git Recomendado

1. Crear rama desde `main`: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
2. Hacer commits pequeños y descriptivos.
3. Abrir Pull Request hacia `main`.
4. Esperar CI en verde y review.
5. Mergear PR (sin push directo a `main`).

### Convención sugerida de ramas

- `feat/<alcance>`
- `fix/<alcance>`
- `chore/<alcance>`
- `docs/<alcance>`

---

## Roadmap

### Fase 1

- Registro de dispositivos
- Dashboard básico
- Control manual
- Comunicación NestJS → ESP32

### Fase 2

- Integración completa con n8n
- Programación de acciones
- Alertas

### Fase 3

- Sensores
- WebSockets
- Estado en tiempo real

### Fase 4

- MQTT
- Home Assistant
- Edge Computing

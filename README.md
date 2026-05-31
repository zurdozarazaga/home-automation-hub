# Home Automation Hub

Sistema de automatización doméstica basado en ESP32, Next.js, NestJS y PostgreSQL.

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

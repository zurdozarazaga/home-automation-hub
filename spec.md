# Technical Specification

## Project Name

Home Automation Hub

---

# Goal

Create a centralized home automation platform capable of controlling multiple ESP32 devices from a web interface and automation workflows.

The system must support manual control, scheduling, monitoring and future sensor integration.

---

# Frontend Vision

The frontend should feel like a mobile-first control surface for the house.

## UI direction

- Dark mode only, with a minimal and calm visual language.
- Large cards, generous spacing and very clear hierarchy.
- Few colors, inspired by Linear, Vercel, Stripe and Apple Home.
- Primary interaction pattern: quick zone control from the home dashboard.

## Information architecture

Design the UI around these concepts:

- Zones
- Devices
- Scenes
- Activity

## Initial dashboard content

- Weather summary for the current city.
- Zone cards for areas like Riego and Luces Patio.
- Device list with online/offline status.
- Sensor cards for future readings.
- Automation cards for scheduled flows.
- Recent activity feed.

## Future structure

The UI should scale to a home model such as:

Casa
├── Jardín
├── Patio
├── Cocina
├── Living
└── Garage

Keep the implementation ready for multiple rooms, devices and scenes without changing the base layout.

---

# Architecture

```text
Next.js
    ↓
NestJS API
    ↓
PostgreSQL

NestJS API
    ↓
ESP32 Devices

n8n
    ↓
NestJS API
```

---

# Domain Rules

## Rule 1

Business logic must never run inside ESP32 devices.

ESP32 devices are physical executors only.

Examples:

Allowed:

- turn relay on
- turn relay off
- report status

Not allowed:

- weather calculations
- irrigation decisions
- scheduling logic

---

## Rule 2

All automation decisions belong to:

- n8n
- Backend services

---

## Rule 3

Frontend never communicates directly with ESP32.

Communication flow:

Frontend
→ Backend
→ ESP32

---

## Rule 4

Every device must be discoverable and manageable through the backend.

---

# Device Model

```ts
interface Device {
  id: string;
  name: string;
  description: string;
  ipAddress: string;
  port: number;
  status: "online" | "offline";
  createdAt: Date;
}
```

---

# Relay Model

```ts
interface Relay {
  id: string;
  deviceId: string;
  name: string;
  gpioPin: number;
  state: boolean;
}
```

---

# Device Endpoints

Expected ESP32 endpoints:

POST /riego/on
POST /riego/off

POST /luces/on
POST /luces/off

GET /estado
GET /health

````

---

# Backend Responsibilities

## Device Management

Create Device

Update Device

Delete Device

Get Device Status

Send Action To Device

---

# API Design

## Devices

GET /devices

POST /devices

GET /devices/:id

PUT /devices/:id

DELETE /devices/:id

---

## Actions

POST /devices/:id/actions

Body:

```json
{
  "action": "turn_on",
  "target": "riego"
}
````

---

# Database

## devices

```sql
id uuid pk
name varchar
description text
ip_address varchar
port integer
status varchar
created_at timestamp
```

## relays

```sql
id uuid pk
device_id uuid fk
name varchar
gpio_pin integer
state boolean
```

## action_logs

```sql
id uuid pk
device_id uuid fk
action varchar
result varchar
created_at timestamp
```

---

# Non Functional Requirements

## Security

JWT Authentication

Role Based Access Control

Rate Limiting

Input Validation

---

## Observability

Structured Logs

Health Checks

Device Connectivity Checks

Action Audit Logs

---

## Development Standards

TypeScript Strict Mode

SOLID Principles

Clean Architecture

Repository Pattern

Dependency Injection

No Business Logic Inside Controllers

No Business Logic Inside ESP32

Services Must Be Unit Testable

---

# Future Features

WebSockets

MQTT

Sensor Support

Energy Monitoring

Home Assistant Integration

Voice Commands

AI Assistant Integration

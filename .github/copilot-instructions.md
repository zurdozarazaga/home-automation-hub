GitHub Copilot Instructions
Project Overview

When constraints conflict, apply them in this order: Security > Architecture Principles > Backend Standards > API Standards > Code Quality > Future Compatibility.

This project is a home automation platform built with:

Next.js
NestJS
PostgreSQL
Prisma ORM
ESP32 devices
n8n automation workflows

The system controls physical devices such as irrigation systems, lights, relays and sensors.

For MQTT and WebSocket features, scaffold integration points in the backend without implementing logic, and document them with TODO comments referencing the future integration.

Architecture Principles
Separation of Responsibilities

Frontend:

User interface
Authentication
Dashboard
Device management

Backend:

Business logic
Device orchestration
Persistence
Security
Auditing

Implement authentication using JWT bearer tokens. Use NestJS Guards for authorization. Define roles such as admin and viewer, and protect all device-action endpoints with role-based access control.

ESP32:

Physical execution only
GPIO control
Device status reporting
Local safety protections

n8n:

Automations
Scheduling
Weather integrations
Notifications
Important Rule

Business logic must never run on ESP32 devices.

ESP32 devices are executors only.

Examples:

Allowed:

Turn relay on
Turn relay off
Report status

Not allowed:

Weather analysis
Irrigation decisions
Scheduling logic
Automation rules
Backend Standards

Use NestJS with:

Modules
Controllers
Services
DTOs
Dependency Injection

Controllers must remain thin.

Business logic belongs in Services.

Database access must be isolated from Controllers.

Use Prisma ORM.

All Prisma calls must be wrapped in try/catch. On failure, log the error with context and throw a NestJS HttpException with an appropriate HTTP status code. Never let raw Prisma errors propagate to the controller or API response.

Enable TypeScript strict mode.

Use environment variables for configuration.

Never hardcode secrets.

API Standards

Follow REST principles.

Validate all inputs.

Return consistent JSON responses.

Use proper HTTP status codes.

Add logging for device actions.

Implement health check endpoints.

Frontend Standards

Use Next.js App Router.

Use TypeScript.

Use Server Components for data-fetching and non-interactive UI. Use Client Components only when browser APIs, event handlers, or React hooks are required.

Keep components under 150 lines. Extract any logic or UI repeated in more than one place into a shared component.

Use feature-based folder organization.

Do not call ESP32 devices directly from the frontend.

Frontend must communicate only with the backend API.

Database Standards

Use Prisma migrations.

Use UUID primary keys.

Track creation and update timestamps.

Store audit logs for device actions.

Avoid business logic inside database queries.

Device Communication

All ESP32 communication must go through the backend.

If an ESP32 device is unreachable or returns a non-success response, the backend must return HTTP 502 to the caller, log the failure with device ID and timestamp, and must not silently swallow the error.

Expected device capabilities:

Turn relay on
Turn relay off
Return status
Return health information

Backend is responsible for:

Authentication
Authorization
Validation
Auditing
Code Quality

Follow SOLID principles.

Prefer composition over inheritance.

Avoid duplicated code.

Keep functions focused on a single responsibility.

Write self-documenting code.

Use meaningful names.

Avoid large files and large classes.

Future Compatibility

Design the system to support:

Multiple ESP32 devices
Additional relay types
Sensors
MQTT
WebSockets
Home Assistant integration
AI-assisted automations

New features should be added without requiring changes to existing device implementations.

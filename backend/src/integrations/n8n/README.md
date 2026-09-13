# N8nModule

Adapter that receives calls from the n8n workflow `sistema_riego_automatizado`
and delegates them to the backend `ActionsService`, which orchestrates the
ESP32 and records the `ActionLog`.

## Current state: guarded dispatch

`POST /integrations/n8n/actions` requires the `service` role
(`@Roles('service')`, enforced by the global guards). The controller
delegates to `ActionsService.execute(deviceId, dto)`; the `deviceId` travels
in the body (`N8nTriggerActionDto`). Validation errors yield 400, dispatch
by any non-service role yields 403, and an unreachable ESP32 yields 502.

## Service credential

Issued offline via `npm run auth:issue-service`
(`sub: 'n8n-sistema-riego'`, `role: 'service'`, 24h TTL). Rotation runbook:
[`../../../docs/integrations/n8n.md`](../../../docs/integrations/n8n.md).

## References

- Architectural rule and target endpoint: [`../../../AGENTS.md`](../../../AGENTS.md)
- Operational detail: [`../../../docs/integrations/n8n.md`](../../../docs/integrations/n8n.md)
- `ActionsService`: `../../actions/actions.service.ts`

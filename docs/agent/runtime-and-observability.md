# Runtime And Observability

## Scope
Runtime quality targets and telemetry requirements.

## Required
- Target API p95 latency below 500ms under normal load.
- Emit structured logs, metrics, and traces.
- Use Aspire OpenTelemetry wiring for service telemetry.
- Keep Aspire Dashboard usage to local diagnostics only.
- For cloud scenarios, use Application Insights as the observability backend.

## Deployment Posture
- Local-first deployment is the default operating model.
- Cloud deployment is a supported profile for future or scaled scenarios.

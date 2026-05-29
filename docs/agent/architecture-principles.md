# Architecture Principles

## Scope
Rules that shape all backend and cross-layer architecture decisions.

## Required
- Keep domain and application logic isolated from infrastructure through ports and adapters.
- Define ports in inner layers as technology-agnostic interfaces.
- Implement adapters in infrastructure only; adapters are replaceable.
- Introduce anti-corruption layers for third-party APIs and SDKs.
- Prevent leakage of external transport or SDK types into domain/application models.
- Separate orchestration, business rules, and I/O concerns.
- Prefer small composable services; do not create god services.

## Design Checks
- Does this change introduce or modify a boundary contract?
- Are third-party types translated at boundaries?
- Is each class or module focused on one responsibility?

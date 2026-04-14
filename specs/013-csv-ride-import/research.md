# Research: CSV Ride Import

**Feature**: 013-csv-ride-import
**Date**: 2026-04-08
**Status**: Complete

## Decision 1: Import processing model

**Decision**: Use a persisted server-side import job with explicit states (`pending`, `validating`, `awaiting-confirmation`, `processing`, `completed`, `cancelled`, `failed`) instead of a single request/response import endpoint.

**Rationale**:
- The spec requires long-running processing, milestone progress updates, reconnect-safe status, and cancellation.
- Persisted job state survives page refresh/navigation and supports status rehydration.
- This model aligns with local-first reliability and avoids request timeout issues.

**Alternatives considered**:
- Single blocking POST import endpoint: rejected due to timeout risk and poor UX for long-running jobs.
- Fire-and-forget import with no persisted status: rejected because users need reliable progress and completion/cancellation summaries.

## Decision 2: CSV schema and validation strategy

**Decision**: Parse headers case-insensitively and require `Date` and `Miles`; treat `Time`, `Temp`, `Tags`, and `Notes` as optional. Validate each row independently and allow valid rows to proceed while reporting invalid rows.

**Rationale**:
- Matches existing ride validation expectations and spec acceptance scenarios.
- Independent row validation prevents one bad row from blocking the entire import.
- Maintains user trust by showing specific field-level errors per row.

**Alternatives considered**:
- Strict all-or-nothing file validation: rejected because it blocks valid data unnecessarily.
- Flexible free-form column mapping UI in v1: rejected as out of scope for initial MVP slice.

## Decision 3: Duplicate policy

**Decision**: Duplicate key is `(date, miles)` against existing rider rides; provide per-conflict choices (`keep existing`, `replace with import`) and an `override all duplicates` bypass.

**Rationale**:
- Date-only matching creates false positives for multi-ride days.
- Date+miles reduces false positives while preserving simple mental model.
- Explicit resolution controls satisfy integrity and user override requirements.

**Alternatives considered**:
- Date-only duplicate key: rejected due to false positives.
- Date+miles+time key: rejected for being too strict when source CSV omits/rounds time values.

## Decision 4: Enrichment policy for gas and weather

**Decision**: Use cache-first lookups; when cache miss occurs, call external API, cache the result, and apply to row. On external failure, retry once; if retry fails, skip enrichment for that field and continue.

**Rationale**:
- Preserves fast local behavior when cache exists.
- Completes historical data when cache is missing.
- Retry-once balances resilience with predictable runtime.

**Alternatives considered**:
- Cache-only enrichment: rejected because user clarified P2 must perform lookups when data is missing.
- Hard-fail import on enrichment error: rejected because enrichment is valuable but not required to create the ride record.

## Decision 5: External API throttling

**Decision**: Throttle enrichment lookups to a maximum of 4 calls per second across gas and weather requests.

**Rationale**:
- Protects against rate-limit errors during bulk imports.
- Provides predictable throughput for ETA calculations.
- Meets clarified requirement from spec clarification session.

**Alternatives considered**:
- No throttling: rejected because burst requests are likely to trigger rate limits.
- Lower fixed throttle (2 calls/sec): rejected as unnecessary slowdown for local single-user workflows.

## Decision 6: Progress and ETA strategy

**Decision**: Emit progress notifications at 25%, 50%, 75%, and 100% milestones only; compute ETA from observed processing rate after at least 10% of rows processed, rounded to nearest 5 minutes.

**Rationale**:
- Matches explicit product requirement for milestone updates.
- Reduces notification noise while still giving meaningful feedback.
- Avoids unstable ETA early in processing.

**Alternatives considered**:
- Per-row progress push: rejected as noisy and unnecessary.
- Fixed ETA by row count only: rejected because enrichment cache miss ratio materially changes runtime.

## Decision 7: Cancellation semantics

**Decision**: Cancellation is cooperative: stop processing remaining rows after current row boundary, keep already-imported rows, and return partial summary.

**Rationale**:
- Compatible with immutable event sourcing and existing ride persistence behavior.
- Avoids complex rollback logic and supports predictable user experience.
- Aligns with clarified requirement that cancellation does not roll back imported rows.

**Alternatives considered**:
- Full rollback cancellation: rejected due to high complexity and poor fit with append-only event model.
- No cancellation support: rejected because long-running imports need user control.

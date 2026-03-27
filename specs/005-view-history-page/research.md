# Research: Ride History Page

**Branch**: `005-view-history-page` | **Date**: 2026-03-26

## Decisions

### 1. History API shape and aggregation source

**Decision**: Provide a dedicated query endpoint `GET /api/rides/history` that returns paged ride rows and summary blocks (`thisMonth`, `thisYear`, `allTime`, `filteredTotal`) in one response.

**Rationale**: This prevents client-side drift between grid rows and totals, reduces round trips, and keeps period calculations centralized in the API where auth and timezone assumptions are already enforced.

**Alternatives considered**:
- Separate endpoints for rows and summaries: simpler handlers but risks inconsistencies and extra calls.
- Client-side totals computed from raw rows: acceptable for tiny datasets, but brittle for paging and large histories.

---

### 2. Date range filter semantics

**Decision**: Treat `from` and `to` as inclusive date boundaries in rider-local date semantics. Return `400` for invalid ranges (`from > to`).

**Rationale**: Inclusive ranges match user expectation for date pickers and align with spec acceptance scenarios. Explicit invalid-range rejection avoids silent wrong totals.

**Alternatives considered**:
- Exclusive end date: can reduce off-by-one in some systems, but less intuitive for riders.
- Auto-swap invalid dates: user-friendly but hides mistakes and complicates auditability.

---

### 3. Reusable summary tile component strategy

**Decision**: Implement a reusable frontend `MileageSummaryCard` component with typed props (`label`, `miles`, `period`, `visualVariant`) and use it in both History and Dashboard views.

**Rationale**: The spec explicitly requires dashboard reuse for year and all-time totals. A shared component ensures visual and formatting consistency and lowers maintenance.

**Alternatives considered**:
- Page-specific summary markup duplicated in History and Dashboard: faster initially, violates reuse requirement and increases drift risk.

---

### 4. Grid behavior for large ride sets

**Decision**: Use TanStack table with server-driven pagination defaults and explicit empty-state rendering when no rows are returned.

**Rationale**: Server pagination scales with growing ride history and keeps initial payloads small while preserving deterministic totals from the API.

**Alternatives considered**:
- Client-side full dataset load with local filtering: easiest MVP, but poor scalability and larger payloads.
- Virtualization-only without paging: good for rendering performance but still requires large data transfer.

---

### 5. Summary period calculation boundaries

**Decision**: Compute `thisMonth` and `thisYear` relative to rider local date context using the same local datetime convention established in ride recording.

**Rationale**: Matches existing assumptions in prior features and this spec, avoiding cross-feature timezone inconsistencies.

**Alternatives considered**:
- UTC-only boundaries: easier to compute globally but can misrepresent rider-visible periods near date boundaries.

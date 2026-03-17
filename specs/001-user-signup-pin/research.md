# Research: Local User Signup and PIN Identity

## Decision 1: Protect PIN with salted non-reversible hashing

- Decision: Use PBKDF2-SHA256 with per-user random salt, store hash metadata (algorithm and iteration count), and verify with constant-time comparison.
- Rationale: Meets the clarified requirement for non-reversible PIN protection, uses built-in .NET cryptography primitives, and supports algorithm/version evolution without schema breaks.
- Alternatives considered: Reversible encryption (rejected because plaintext recovery risk), raw SHA hashing (rejected because weak against offline brute force), Argon2 dependency now (deferred to avoid extra dependency complexity in local MVP).

## Decision 2: Normalize names for both uniqueness and lookup

- Decision: Persist both `DisplayName` and `NormalizedName`, where `NormalizedName` is trimmed and case-insensitive canonical form; enforce uniqueness on `NormalizedName`.
- Rationale: Matches clarified behavior for duplicate detection and identification, avoids user confusion from case/space variance, and gives deterministic lookups.
- Alternatives considered: Case-sensitive exact matching (rejected due UX inconsistency), internal-whitespace collapsing (rejected because not required), fuzzy matching (rejected because it weakens identity precision).

## Decision 3: Progressive delay for repeated failed PIN attempts

- Decision: Apply progressive delay schedule per user on consecutive failures, cap at 30 seconds, and reset delay state immediately after successful identification.
- Rationale: Implements clarified security behavior while preserving local usability and preventing hard lockout support burdens.
- Alternatives considered: Hard lockout after N attempts (rejected for poor UX in local MVP), no throttling (rejected for brute-force exposure), fixed delay only (rejected as weaker deterrent than progressive delay).

## Decision 4: Reliable event delivery via transactional outbox pattern

- Decision: Persist user record and outbox event in one transaction, then publish asynchronously with retry until marked delivered.
- Rationale: Satisfies clarified requirement to keep persisted user and continue retrying event publication when immediate emission fails.
- Alternatives considered: Inline publish in request path (rejected due reliability gap), drop event on publish failure (rejected by requirement), external broker first (deferred as unnecessary complexity for local-first flow).

## Decision 5: Local persistence with database-generated user ID

- Decision: Use SQLite with EF Core migrations and database-generated numeric identity for `UserId`.
- Rationale: Aligns with local-first constitution guidance, satisfies requirement that each user gets a new database ID, and keeps setup lightweight.
- Alternatives considered: In-memory storage (rejected because non-durable), file-based custom persistence (rejected due migration/query overhead), cloud database now (rejected as out of scope for this feature).

## Decision 6: Minimal API contract with explicit failure semantics

- Decision: Expose `POST /api/users/signup` and `POST /api/users/identify` with explicit error semantics for validation, duplicate name, unauthorized PIN, and throttling.
- Rationale: Keeps contract small and testable while covering all required local user flows and edge behaviors.
- Alternatives considered: Single combined endpoint (rejected due mixed responsibilities), UI-only local state without API (rejected because API and events are in scope), GraphQL schema now (rejected as over-scoped).

## Decision 7: Validation layering mirrors constitution requirements

- Decision: Enforce name and PIN rules in three layers: React form state, API DTO validation, and database constraints/indexes.
- Rationale: Maintains constitution-mandated defense in depth and prevents invalid data from bypassing a single validation layer.
- Alternatives considered: Client-only validation (rejected for bypass risk), API-only validation (rejected for weaker UX), DB-only validation (rejected for poor request feedback quality).

## Clarification Resolution Status

All clarified requirements from [spec.md](spec.md) are resolved in technical decisions. No unresolved clarification markers remain.

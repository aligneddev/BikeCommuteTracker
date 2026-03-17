# Data Model: Local User Signup and PIN Identity

## Entity: User

Represents a local rider identity record.

| Field | Type | Required | Constraints | Notes |
|------|------|----------|-------------|-------|
| UserId | long | Yes | Primary key, database-generated | Unique user database ID returned by signup |
| DisplayName | string | Yes | Trimmed, non-empty, max length policy enforced by validation | Preserved user-facing name |
| NormalizedName | string | Yes | Trimmed + case-insensitive canonical form, unique index | Used for duplicate checks and identification lookup |
| CreatedAtUtc | datetime | Yes | Default current UTC | Signup timestamp |
| IsActive | bool | Yes | Default true | Reserved for future lifecycle controls |

## Entity: UserCredential

Stores protected PIN credential material for one user.

| Field | Type | Required | Constraints | Notes |
|------|------|----------|-------------|-------|
| UserCredentialId | long | Yes | Primary key, database-generated | Internal key |
| UserId | long | Yes | Foreign key to User, unique | One-to-one with user |
| PinHash | binary/string | Yes | Non-null | Non-reversible salted PIN hash |
| PinSalt | binary/string | Yes | Non-null | Cryptographically random per user |
| HashAlgorithm | string | Yes | Non-null | Example: PBKDF2-SHA256 |
| IterationCount | int | Yes | Positive integer | Supports algorithm agility |
| CredentialVersion | int | Yes | Default 1 | Future hash migration support |
| UpdatedAtUtc | datetime | Yes | Default current UTC | Last credential update time |

## Entity: AuthAttemptState

Tracks throttle state for repeated failed identification attempts.

| Field | Type | Required | Constraints | Notes |
|------|------|----------|-------------|-------|
| UserId | long | Yes | Primary key, foreign key to User | One state record per user |
| ConsecutiveWrongCount | int | Yes | Default 0, non-negative | Drives progressive delay |
| LastWrongAttemptUtc | datetime | No | Nullable | For delay progression calculation |
| DelayUntilUtc | datetime | No | Nullable | Next allowed processing time |
| LastSuccessfulAuthUtc | datetime | No | Nullable | Audit and reset marker |

## Entity: OutboxEvent

Reliable event publication queue for eventual delivery.

| Field | Type | Required | Constraints | Notes |
|------|------|----------|-------------|-------|
| OutboxEventId | long | Yes | Primary key, database-generated | Queue ordering key |
| AggregateType | string | Yes | Non-null | `User` for this feature |
| AggregateId | long | Yes | Non-null | UserId for the related aggregate |
| EventType | string | Yes | Non-null | `UserRegistered` for this feature |
| EventPayloadJson | string | Yes | Non-null | Serialized event contract payload |
| OccurredAtUtc | datetime | Yes | Non-null | Domain event timestamp |
| RetryCount | int | Yes | Default 0 | Incremented per failed publish |
| NextAttemptUtc | datetime | Yes | Non-null | Scheduler retry cursor |
| PublishedAtUtc | datetime | No | Nullable | Set when delivery succeeds |
| LastError | string | No | Nullable | Diagnostic info for failures |

## Contract Entity: UserRegisteredEvent

Immutable event payload emitted after successful signup persistence.

| Field | Type | Required | Constraints | Notes |
|------|------|----------|-------------|-------|
| EventId | string/guid | Yes | Unique | Event identity |
| UserId | long | Yes | Non-null | Newly created user ID |
| UserName | string | Yes | Non-null | Display name at signup time |
| OccurredAtUtc | datetime | Yes | Non-null | Event occurrence time |
| Source | string | Yes | Non-null | Source marker (local API) |

No PIN, hash, or salt fields are permitted in event payload.

## Relationships

- User 1:1 UserCredential
- User 1:1 AuthAttemptState
- User 1:N OutboxEvent
- OutboxEvent carries one UserRegisteredEvent payload per signup

## Validation Rules

- Name input is trimmed before validation; empty-after-trim names are rejected.
- Name matching for duplicates and lookup uses the same normalized form.
- PIN accepts configured local policy (numeric-only, length 4 to 8 from spec assumptions).
- PIN is never persisted or emitted in plaintext.
- Duplicate normalized names are rejected before user creation and prevented by database uniqueness.
- Failed PIN attempts increment state and apply progressive delay with 30-second cap.
- Successful identification resets throttle progression immediately.

## State Transitions

### Signup Lifecycle

1. `SignupRequested`
2. `Validated`
3. `UserPersisted` (User + UserCredential + AuthAttemptState created)
4. `EventQueued` (OutboxEvent created in same transaction)
5. `EventPublished` (asynchronous retry loop marks success)

### Identification Lifecycle

1. `IdentifyRequested`
2. `ThrottleEvaluated`
3. `Authorized` (success, counters reset) or `Denied` (counter increments and delay advances)

### Outbox Lifecycle

1. `Pending`
2. `Publishing`
3. `Published` or `RetryScheduled`

## Database Integrity Constraints

- Primary key constraints on all entity IDs.
- Unique index on `User.NormalizedName`.
- Foreign key constraints from `UserCredential` and `AuthAttemptState` to `User`.
- Non-null constraints on all required security and event fields.
- Check constraint (or equivalent validation) for non-negative retry and attempt counters.

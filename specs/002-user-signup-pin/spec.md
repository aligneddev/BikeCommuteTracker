# Feature Specification: Local User Signup and PIN Identity

**Feature Branch**: `001-user-signup-pin`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "Create and identify the user. Create a minimal signup screen (name and pin) with the validation, api, events and database structure to store that. Each user will get a new database id. We are focusing on the local flow now, in the future we will add Azure hosting and OAuth authentication. The pin will be the authorization approach and needs to be encrypted."

## Clarifications

### Session 2026-03-13

- Q: What PIN protection rule should the specification require for stored credentials? → A: Store PIN as non-reversible salted hash; verify by hash comparison only.
- Q: How should signup handle a name that already exists? → A: Reject signup and return "name already exists".
- Q: What brute-force protection should apply to repeated wrong PIN attempts during identification? → A: Apply progressive delay after each wrong attempt (for example 1s to 30s), reset on successful login.
- Q: If event emission fails after user persistence succeeds, what should the system do? → A: Keep persisted user and retry event publication until success.
- Q: How should name matching work for both duplicate-signup checks and identification? → A: Trim leading/trailing spaces and compare case-insensitively.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign Up With Name and PIN (Priority: P1)

As a new rider using the app locally, I want to create a profile with my name and a PIN so I can start using the app with a personal identity.

**Why this priority**: Without signup, no user identity exists and no bike tracking workflow can be personalized.

**Independent Test**: Can be fully tested by opening the signup screen, entering valid values, submitting, and verifying that a new user profile is created with a generated database ID.

**Acceptance Scenarios**:

1. **Given** no existing profile with the entered name, **When** the user submits a valid name and valid PIN, **Then** the system creates a user profile, assigns a new database ID, and confirms signup success.
2. **Given** the user enters invalid values, **When** the user submits the form, **Then** the system blocks submission and shows field-level validation feedback.
3. **Given** an existing profile with a name that matches after trimming and case-insensitive comparison, **When** the user submits signup, **Then** the system rejects the request and returns "name already exists" without creating a new user record.

---

### User Story 2 - Identify and Authorize User by PIN (Priority: P2)

As a returning rider, I want to identify myself with my name and PIN so the app can authorize me as the correct local user.

**Why this priority**: The requested local authorization approach depends on PIN-based identity confirmation after signup.

**Independent Test**: Can be fully tested by creating a profile, then submitting name and PIN in an identification request and confirming authorized vs unauthorized outcomes.

**Acceptance Scenarios**:

1. **Given** an existing user profile, **When** the correct name and PIN are provided, **Then** the system authorizes the user and returns the user identity.
2. **Given** an existing user profile, **When** an incorrect PIN is provided, **Then** the system denies authorization without exposing sensitive credential data.
3. **Given** repeated consecutive incorrect PIN attempts, **When** each subsequent attempt is submitted, **Then** the system applies a progressively longer delay before processing and resets the delay after the next successful identification.
4. **Given** an existing user profile, **When** the submitted name differs only by letter case or leading/trailing spaces and the PIN is correct, **Then** the system authorizes the same user identity.

---

### User Story 3 - Persist Signup Data and Emit Registration Event (Priority: P3)

As a product owner, I want signup data to be stored and a registration event to be emitted so local flows are durable now and integration-ready later.

**Why this priority**: Durable storage and event emission support reliable local behavior now and reduce rework for future hosting and identity extensions.

**Independent Test**: Can be fully tested by completing signup once and verifying a persisted user record plus exactly one emitted registration event containing required non-sensitive attributes.

**Acceptance Scenarios**:

1. **Given** a successful signup, **When** persistence completes, **Then** the stored user record includes the generated ID, user name, and salted PIN hash representation (never plaintext PIN).
2. **Given** a successful signup, **When** event publication occurs, **Then** a user-registered event is emitted with user ID and signup timestamp.
3. **Given** user persistence succeeds and initial event publication fails, **When** retry processing continues, **Then** the user remains persisted and the user-registered event is eventually published successfully.

---

### Edge Cases

- Duplicate name signup attempts are rejected with "name already exists" and no new user ID is created.
- How does the system handle a PIN that is too short, too long, or contains unsupported characters?
- Whitespace-only name or PIN input is rejected by validation.
- Name matching for duplicate checks and identification uses trimmed, case-insensitive comparison.
- Consecutive incorrect PIN attempts trigger progressive delay and the delay resets after a successful identification.
- If event emission fails after persistence succeeds, the user remains persisted and event publication is retried until successful.
- What happens when storage is temporarily unavailable during signup?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a minimal local signup screen with exactly two required user inputs: name and PIN.
- **FR-002**: System MUST validate signup input before submission acceptance, including non-empty name after trimming and PIN format rules.
- **FR-003**: System MUST reject invalid signup submissions and return clear validation messages mapped to the invalid field(s).
- **FR-004**: System MUST expose a local signup API capability that accepts name and PIN and returns signup success or failure with reason.
- **FR-005**: System MUST create exactly one new user record for each successful signup and assign a unique database-generated user ID.
- **FR-006**: System MUST store PIN data only as a non-reversible salted hash and MUST never store or return plaintext PIN values.
- **FR-007**: System MUST support user identification and authorization using normalized name (trimmed and case-insensitive) plus PIN after signup.
- **FR-008**: System MUST deny authorization when provided PIN data does not match the stored salted PIN hash representation.
- **FR-009**: System MUST emit a user-registered event after successful signup persistence.
- **FR-010**: System MUST include user ID, user name, and registration timestamp in the user-registered event payload while excluding plaintext PIN.
- **FR-011**: System MUST persist signup and credential data in a local database structure suitable for local development execution.
- **FR-012**: System MUST keep the local PIN-based flow isolated from external identity providers for this feature scope.
- **FR-013**: System MUST reject signup when the normalized name already exists and return the reason "name already exists" without creating a new user record.
- **FR-014**: System MUST apply progressive delay for consecutive incorrect PIN attempts during identification, increasing delay per attempt up to a configured maximum delay of 30 seconds.
- **FR-015**: System MUST reset incorrect-attempt delay progression immediately after a successful identification.
- **FR-016**: System MUST keep the user record persisted when event emission fails after persistence and MUST retry user-registered event publication until successful delivery.
- **FR-017**: System MUST apply the same normalized-name comparison rule (trimmed, case-insensitive) for duplicate-signup checks and identification lookups.

### Key Entities *(include if feature involves data)*

- **User**: Represents a local rider profile. Key attributes include user ID, display name, normalized name key, created timestamp, and active status.
- **UserCredential**: Represents protected authorization data for a user. Key attributes include credential ID, user ID, salted PIN hash representation, credential version, and last-updated timestamp.
- **UserRegisteredEvent**: Represents the domain event emitted after signup. Key attributes include event ID, user ID, user name, occurred timestamp, and source context.

## Assumptions & Dependencies

- The initial local release supports a single environment focused on local execution only.
- PIN policy default for MVP is numeric-only with a minimum of 4 and maximum of 8 characters.
- Future Azure hosting and OAuth-based identity are out of scope for this feature and will be addressed in later features.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of first-time users can complete signup in under 60 seconds without assistance.
- **SC-002**: 100% of successful signup operations result in a newly generated user ID and a persisted user record.
- **SC-003**: 100% of stored credential records contain no plaintext PIN values and only non-reversible salted PIN hash values.
- **SC-004**: At least 99% of valid identification attempts succeed and at least 99% of invalid PIN attempts are denied.
- **SC-005**: 100% of successful signup operations produce one user-registered event containing user ID and timestamp.
- **SC-006**: 100% of duplicate-name signup attempts are rejected with no additional user record created.
- **SC-007**: 100% of identification attempts after consecutive wrong PIN entries include progressive delay behavior, and delay progression resets on the first successful identification.
- **SC-008**: 100% of cases where persistence succeeds and initial event emission fails result in eventual successful event publication without deleting the persisted user.
- **SC-009**: 100% of duplicate-signup checks and identification lookups use trimmed, case-insensitive name matching behavior.

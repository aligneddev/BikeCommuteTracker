# Feature Specification: User Login with PIN

**Feature Branch**: `003-user-login`  
**Created**: 2026-03-17  
**Status**: Draft  
**Input**: User description: "Add User login. The user can login with their pin. They cannot add miles or view their data until they login. Split the existing Create user and identify user page into separate pages. Change Identify to login. After login, the user will be moved to a shell page for viewing their miles (which will be created later)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Login with Name and PIN (Priority: P1)

As a returning rider, I want to log in using my name and PIN so the app knows who I am and lets me access my personal data.

**Why this priority**: Login is the entry point to all protected functionality. Without it, no rider can add miles or view data.

**Independent Test**: Can be fully tested by navigating to the Login page, entering an existing name and correct PIN, submitting, and verifying that the user is redirected to the miles shell page.

**Acceptance Scenarios**:

1. **Given** a registered user exists, **When** the user submits their correct name and PIN on the Login page, **Then** the system authenticates the user and redirects them to the miles shell page.
2. **Given** a registered user exists, **When** the user submits an incorrect PIN, **Then** the system displays an error message and the user remains on the Login page.
3. **Given** no registered user with the given name, **When** the user submits the Login form, **Then** the system displays an error message indicating the user was not found and the user remains on the Login page.
4. **Given** the user is not logged in, **When** the user attempts to navigate to a protected page (add miles, view miles), **Then** the system redirects them to the Login page.

---

### User Story 2 - Navigate to Signup from Login (Priority: P2)

As a new rider arriving at the Login page, I want an easy path to the Signup page so I can create my profile without confusion.

**Why this priority**: Separating Create User and Login into distinct pages requires a clear navigation path between them so new users are not stranded.

**Independent Test**: Can be fully tested by visiting the Login page and confirming a link or button navigates cleanly to the Create User (Signup) page.

**Acceptance Scenarios**:

1. **Given** the user is on the Login page, **When** they select the "Create account" or equivalent link, **Then** they are taken to the separate Create User page.
2. **Given** the user is on the Create User page, **When** they select the "Already have an account" or equivalent link, **Then** they are taken to the Login page.

---

### User Story 3 - Post-Login Miles Shell Page (Priority: P3)

As a logged-in rider, I want to land on a miles shell page after login so I have a clear placeholder for viewing and adding my miles later.

**Why this priority**: The miles functionality is out of scope for this feature, but the navigation destination must exist so login can complete end-to-end.

**Independent Test**: Can be fully tested by completing login and verifying the miles shell page is displayed with appropriate placeholder content and the logged-in user's name visible.

**Acceptance Scenarios**:

1. **Given** a successful login, **When** the user is redirected to the miles shell page, **Then** the page displays a welcome message with the user's name and a placeholder for future miles content.
2. **Given** the user is on the miles shell page, **When** they are not authenticated, **Then** the system redirects them to the Login page.
3. **Given** the user has previously added miles, **When** the miles entry form is shown, **Then** the miles input field is pre-filled with the value from their last entry to reduce repetitive input.

---

### Edge Cases

- What happens when the user navigates directly to the Login page while already logged in?
- How does the system behave when the Login form is submitted with empty name or PIN fields?
- What happens if the server is unreachable when the user submits the Login form?
- How does the browser handle the back button after a successful login redirect?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated Login page separate from the Create User (Signup) page.
- **FR-002**: System MUST rename the existing "Identify" user flow to "Login" in all navigation, labels, and page titles.
- **FR-003**: System MUST split the existing combined Create User and Identify page into two independent pages: a Create User page and a Login page.
- **FR-004**: System MUST authenticate a user by accepting their name and PIN on the Login page and verifying credentials against stored data.
- **FR-005**: System MUST redirect the user to the miles shell page upon successful login.
- **FR-006**: System MUST display a clear, user-friendly error message when login fails due to incorrect credentials or unrecognized name.
- **FR-007**: System MUST block access to protected pages (miles shell, future add-miles page) for users who are not logged in, redirecting unauthenticated users to the Login page.
- **FR-008**: System MUST provide navigation from the Login page to the Create User page and from the Create User page to the Login page.
- **FR-009**: System MUST display a miles shell page as the post-login destination, showing the logged-in user's name and a placeholder for future miles content.
- **FR-010**: System MUST validate that name and PIN fields are non-empty before submitting the Login form and display inline field-level validation messages.
- **FR-011**: System MUST maintain the authenticated session so the user remains logged in when navigating between protected pages within the same session.
- **FR-012**: System MUST pre-fill the miles entry input with the value from the user's last miles entry when the miles entry form is presented, so that returning riders do not need to re-enter their typical commute distance.

### Key Entities *(include if feature involves data)*

- **LoginSession**: Represents the active identity for the current browser session. Key attributes include user ID, display name, and session active flag.
- **MilesShellPage**: Represents the protected landing page after login. Displays the authenticated user's name and placeholder content for future miles features.

## Assumptions & Dependencies

- Authentication credential verification reuses the PIN-based identification mechanism established in the `001-user-signup-pin` feature (name + PIN hash comparison with brute-force protection).
- Session state is managed client-side (e.g., browser session storage) for the local-only flow; no server-side session management is required at this stage.
- The miles shell page contains no functional miles content — it is a structural placeholder to be extended in a future feature.
- The user can only be logged in as one identity per browser session at a time.
- There is no "remember me" or persistent login across browser sessions for this feature.
- Future OAuth/Azure identity integration is out of scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful login attempts result in the user being redirected to the miles shell page.
- **SC-002**: 100% of failed login attempts (wrong PIN or unknown name) result in an error message displayed on the Login page with no redirect.
- **SC-003**: 100% of unauthenticated attempts to access a protected page are redirected to the Login page.
- **SC-004**: At least 95% of users can complete login in under 30 seconds without assistance.
- **SC-005**: The Login page and Create User page are independently navigable with no shared page combining both flows.
- **SC-006**: 100% of successful logins result in the miles shell page displaying the correct authenticated user's name.
- **SC-007**: 100% of miles entry form presentations pre-fill the miles input with the user's last recorded miles value when a previous entry exists.


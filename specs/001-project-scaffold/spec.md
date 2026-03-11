# Feature Specification: Project Structure and Scaffolding

**Feature Branch**: `001-project-scaffold`  
**Created**: 2026-03-11  
**Status**: Draft  
**Input**: User description: "Create the structure for this application. Create projects with the latest cli approaches. Do not implement any code, do not create database structure. End Goal: have a buildable runnable app that has a simple hello screen and an running api with a start to the readme"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Sets Up Project Structure (Priority: P1)

A developer clones the repository and needs to understand the application structure, set up their development environment, and verify the build works. They follow the setup instructions in the README to get the project ready for development.

**Why this priority**: This is critical for any developer on-boarding to the project. Without a clear structure and working setup, development cannot begin.

**Independent Test**: Can be fully tested by cloning the repository, following README instructions, and successfully building the application with `dotnet build`.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repository, **When** developer opens the solution file, **Then** Visual Studio/Rider recognizes all projects
2. **Given** the repository is cloned, **When** developer runs `dotnet build`, **Then** all projects compile without errors
3. **Given** the development environment is set up, **When** developer reads the README, **Then** they understand the project structure and can identify the purpose of each project
4. **Given** all projects are built, **When** developer runs the AppHost, **Then** the application starts and displays the hello screen

---

### User Story 2 - Developer Runs Frontend Application (Priority: P1)

A frontend developer needs to run and test the frontend application independently. They want to see a working hello screen to verify the frontend tooling is set up correctly.

**Why this priority**: Frontend development must be independently testable. A developer should be able to run just the frontend and verify it works without needing the full backend running.

**Independent Test**: Can be fully tested by navigating to the frontend directory, installing dependencies, and running the dev server to see the hello screen in a browser.

**Acceptance Scenarios**:

1. **Given** the frontend project exists, **When** developer navigates to `src/BikeTracking.Frontend` and runs `npm install`, **Then** dependencies install successfully
2. **Given** frontend dependencies are installed, **When** developer runs `npm run dev`, **Then** the development server starts on a local port
3. **Given** the dev server is running, **When** developer opens the app in a browser, **Then** they see a hello screen with basic styling
4. **Given** the hello screen is displayed, **When** developer makes changes to the source files, **Then** hot reload updates the page automatically

---

### User Story 3 - Developer Runs API Server (Priority: P1)

A backend developer needs to run the API server and verify it's responding to requests. They want to confirm the API infrastructure is properly scaffolded and callable.

**Why this priority**: The API is the core of the backend system. Developers must be able to independently start the server and test endpoints.

**Independent Test**: Can be fully tested by running the API with `dotnet run` and making an HTTP request to verify a response.

**Acceptance Scenarios**:

1. **Given** the API project is built, **When** developer runs the AppHost with `dotnet run`, **Then** the API server starts without errors
2. **Given** the API server is running, **When** developer makes a request to a health check endpoint, **Then** they receive a successful response
3. **Given** the server is running, **When** developer checks the console output, **Then** they see clear logging indicating the API is listening on a specific port
4. **Given** the API is running, **When** developer stops the server, **Then** it shuts down cleanly without errors

---

### User Story 4 - Project Follows Modern .NET Conventions (Priority: P2)

As a DevOps engineer reviewing the project, I want to confirm that the project uses modern .NET conventions and best practices (e.g., .NET Aspire, minimal APIs, modern project structure) so that the foundation is solid for future development.

**Why this priority**: While not blocking initial development, using modern conventions ensures the codebase is maintainable, scalable, and follows industry standards. This matters for long-term project health.

**Independent Test**: Can be tested by reviewing the project files for use of modern tooling (Aspire for orchestration, minimal APIs, etc.) and confirming the solution structure matches .NET best practices.

**Acceptance Scenarios**:

1. **Given** the project files exist, **When** reviewed, **Then** the solution uses .NET Aspire for multi-project orchestration
2. **Given** the API project exists, **When** examined, **Then** it demonstrates the minimal API pattern (if applicable)
3. **Given** the project structure exists, **When** analyzed, **Then** it separates concerns into API, Frontend, Domain, and Infrastructure projects
4. **Given** the AppHost project exists, **When** reviewed, **Then** it configures and orchestrates all services

---

### Edge Cases

- What happens when a developer has an outdated Node.js version? *(Frontend won't build)*
- What happens when port collision occurs (API running on expected port already taken)? *(Error shown in console, documented in README)*
- What happens when a developer lacks .NET 10+ installed? *(Build fails with clear error message about required SDK version)*

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Solution MUST use multi-project structure with separate concerns: API, Frontend, Domain, AppHost, and Service Defaults
- **FR-002**: API project MUST be a runnable .NET service that can start independently 
- **FR-003**: Frontend project MUST be a TypeScript/Vue-based application with development server capability
- **FR-004**: AppHost project MUST orchestrate and configure all services for local development using .NET Aspire
- **FR-005**: Solution MUST be buildable with `dotnet build` command without errors
- **FR-006**: Solution MUST have a solution file (.slnx) that includes all projects
- **FR-007**: Frontend MUST display a simple hello screen when application starts
- **FR-008**: API MUST have at least one callable endpoint for verification
- **FR-009**: Project MUST follow .NET CLI conventions for project structure and organization
- **FR-010**: Project configuration MUST enable hot reload for frontend development
- **FR-011**: README MUST document project structure, setup instructions, and how to run each component

### Key Entities *(include if feature involves data)*

- **Solution Structure**: Multi-project .Net solution with proper folder organization
  - BikeTracking.Api: REST API server
  - BikeTracking.Frontend: Web UI client
  - BikeTracking.Domain.FSharp: Functional domain logic
  - BikeTracking.AppHost: Orchestration and configuration
  - BikeTracking.ServiceDefaults: Shared service configuration

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: New developer can clone repository and have a working build in under 10 minutes following README instructions
- **SC-002**: `dotnet build` completes successfully with zero errors and warnings related to missing projects or configuration
- **SC-003**: AppHost can start and orchestrate at least the API and Frontend services without crashes
- **SC-004**: Frontend displays hello screen within 5 seconds of starting development server
- **SC-005**: API responds to health check or test endpoint within 2 seconds of server startup
- **SC-006**: Solution contains clear, documented project structure with 5+ documented projects
- **SC-007**: README provides step-by-step instructions that enable 90% of developers to run the project successfully on first attempt
- **SC-008**: Project uses modern .NET tooling (Aspire, .NET 10+, minimal APIs pattern where applicable)

## Assumptions

- **.NET 10+**: Developers have .NET 10 or later installed (specified in global.json)
- **Node.js/npm**: Frontend developers have Node.js 18+ and npm installed for frontend development
- **Code editor**: Developers use Visual Studio 2022+, Rider, or VS Code with C# and TypeScript support
- **Hello screen scope**: "Hello screen" is a simple static page with basic styling, not an interactive dashboard
- **API endpoint**: API includes at least one working endpoint (e.g., health check, sample data endpoint) for verification
- **No database**: Specification explicitly excludes database schema or ORM setup; data layer is out of scope
- **Monorepo structure**: Project uses a single git repository with multiple projects organized in `/src/` folder
- **Frontend framework**: Frontend uses modern JavaScript/TypeScript tooling (Vue with Vite based on existing package.json)
- **Service orchestration**: .NET Aspire is used for local development orchestration (not production deployment)

## Scope Boundaries

### In Scope
- Project folder structure and organization
- Multi-project solution creation and configuration
- Basic working hello screen on frontend
- API server that starts and responds to requests
- Build system configuration
- Setup and running documentation in README

### Out of Scope
- Database schema or ORM configuration
- Actual feature implementation or business logic
- Authentication, authorization
- API endpoint business logic (only verification endpoints)
- Deployment infrastructure
- Testing implementation
- CSS styling beyond a basic hello screen
- Performance optimization


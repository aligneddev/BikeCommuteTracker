---
description: "Tasks for Project Structure and Scaffolding"
---

# Tasks: Project Structure and Scaffolding

**Input**: Design documents from `/specs/001-project-scaffold/`
**Prerequisites**: plan.md ✅ (required), spec.md ✅ (user stories) 
**Feature Branch**: `001-project-scaffold`

**Tests**: NOT included in this phase (explicitly out of scope - scaffolding only)

**Organization**: Tasks are grouped by user story + phase to enable independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4)
- File paths are relative to repo root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish project structure foundation required before any feature work

- [ ] T001 Verify and document existing solution structure in `BikeTracking.slnx`
- [ ] T002 Add `.gitignore` entries for build artifacts (`bin/`, `obj/`, `dist/`, `node_modules`)
- [ ] T003 Verify `global.json` specifies .NET 10+ as required SDK version
- [ ] T004 [P] Ensure all 5 project files exist and are syntactically valid (`.csproj`, `.fsproj`)
- [ ] T005 [P] Initialize solution file (`BikeTracking.slnx`) to include all 5 projects

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story implementation

**⚠️ CRITICAL**: No feature work starts until this phase completes

### Service Defaults & Shared Configuration

- [ ] T006 Configure `BikeTracking.ServiceDefaults/Extensions.cs` with common service setup methods
- [ ] T007 [P] Create extension method for logging configuration in `BikeTracking.ServiceDefaults/Extensions.cs`
- [ ] T008 [P] Create extension method for API health checks in `BikeTracking.ServiceDefaults/Extensions.cs`

### AppHost Orchestration

- [ ] T009 Initialize `BikeTracking.AppHost/AppHost.cs` with Aspire builder configuration
- [ ] T010 [P] Configure `BikeTracking.AppHost/AppHost.cs` to add API service reference
- [ ] T011 [P] Configure `BikeTracking.AppHost/AppHost.cs` to add Frontend service reference
- [ ] T012 Configure environment variables in AppHost for local development
- [ ] T013 Test AppHost can instantiate and configure services without errors

### Solution Build Validation

- [ ] T014 Verify `dotnet build` compiles all projects without errors
- [ ] T015 Verify solution builds in Debug configuration
- [ ] T016 [P] Verify all project references are correctly configured

### README Foundation

- [ ] T017 Create `README.md` structure with sections: Overview, Prerequisites, Getting Started, Project Structure, Running the Application
- [ ] T018 Document .NET version requirement (10+) in README Prerequisites section
- [ ] T019 Document Node.js requirement for frontend in README Prerequisites section
- [ ] T020 Create empty sections in README for Backend Setup, Frontend Setup, API Endpoints (to be completed in user story phases)

**Checkpoint**: Foundation complete - `dotnet build` succeeds, AppHost structure ready. User story work can now begin in parallel.

---

## Phase 3: User Story 1 - Developer Sets Up Project Structure (Priority: P1)

**Goal**: New developer can clone repository, understand structure, build solution, and run AppHost

**Independent Test**: Clone repo → read README → run `dotnet build` → run AppHost → see both API and Frontend services start

### Implementation for US1

- [ ] T021 [US1] Document "Project Structure" section in `README.md` with diagram showing 5 projects and their purposes
- [ ] T022 [US1] Document each project folder with inline comment in solution explaining folder purpose:
  - `src/BikeTracking.Api/` → REST API layer
  - `src/BikeTracking.Frontend/` → Single Page Application
  - `src/BikeTracking.Domain.FSharp/` → Type-safe domain logic
  - `src/BikeTracking.AppHost/` → Service orchestration
  - `src/BikeTracking.ServiceDefaults/` → Shared configuration
- [ ] T023 [US1] Add "Getting Started" section to `README.md` with step-by-step setup:
  - Clone repository
  - Install dependencies (`dotnet restore`, `npm install` in Frontend)
  - Build solution (`dotnet build`)
  - Run AppHost
  - Expected output showing both services running
- [ ] T024 [US1] Verify `BikeTracking.slnx` includes all 5 projects and solution loads cleanly
- [ ] T025 [US1] Test end-to-end: clone → build → run AppHost, confirm both services start successfully
- [ ] T026 [P] [US1] Add troubleshooting section to `README.md` for common errors:
  - "Port already in use" with instructions to find/kill process
  - ".NET SDK not found" with version requirement
  - "npm install fails" with Node.js version requirement
- [ ] T027 [P] [US1] Add "Project Dependencies" diagram or table in `README.md` showing which projects depend on which

**Checkpoint**: Developer can complete initial setup in <10 minutes following README

---

## Phase 4: User Story 2 - Developer Runs Frontend Application (Priority: P1)

**Goal**: Frontend developer can independently run and modify the hello screen with hot reload

**Independent Test**: `cd src/BikeTracking.Frontend` → `npm install` → `npm run dev` → browser opens hello screen → CSS changes hot-reload

### Implementation for US2

- [ ] T028 [US2] Create hello screen markup in `src/BikeTracking.Frontend/src/my-app.html` with:
  - Basic HTML structure
  - "Hello, Bike Tracking!" heading
  - Description paragraph
  - Basic styling (inline or minimal CSS)

- [ ] T029 [US2] Verify `src/BikeTracking.Frontend/vite.config.ts` enables hot reload with `@vitejs/plugin-vue`

- [ ] T030 [US2] Update `src/BikeTracking.Frontend/package.json` to include:
  - Script: `dev` → `vite` (dev server)
  - Script: `build` → `vite build` (production build)
  - Script: `preview` → `vite preview` (preview production build)

- [ ] T031 [US2] Verify `src/BikeTracking.Frontend/src/main.ts` correctly initializes Vue app and loads `my-app.html`

- [ ] T032 [US2] Setup environment configuration for frontend:
  - Create `.env.local` template with API endpoint
  - Document in `README.md` Frontend Setup section

- [ ] T033 [US2] Add Frontend Setup instructions to `README.md`:
  ```
  1. Navigate to src/BikeTracking.Frontend
  2. Run `npm install` to install dependencies
  3. Run `npm run dev` to start dev server
  4. Open browser to http://localhost:5173 (or displayed port)
  5. Should see "Hello, Bike Tracking!" message
  ```

- [ ] T034 [P] [US2] Create basic CSS for hello screen in `src/BikeTracking.Frontend/src/index.html` or stylesheet:
  - Center-aligned content
  - Readable font and spacing
  - Simple color scheme

- [ ] T035 [P] [US2] Test hot reload: start dev server, modify `my-app.html`, verify page updates without manual refresh

- [ ] T036 [US2] Update `README.md` Troubleshooting section with Frontend-specific issues:
  - "npm install fails" → check Node version
  - "Dev server won't start" → check port 5173 not in use
  - "Hot reload not working" → check Vite config

**Checkpoint**: Frontend runs independently with hello screen and hot reload working

---

## Phase 5: User Story 3 - Developer Runs API Server (Priority: P1)

**Goal**: Backend developer can independently start API and verify endpoints respond to requests

**Independent Test**: Run AppHost → API starts on default port → GET `/health` returns 200 → check console logs for startup messages

### Implementation for US3

- [ ] T037 [US3] Configure `src/BikeTracking.Api/Program.cs` with minimal APIs:
  - Add Aspire service defaults
  - Configure logging
  - Add health check endpoint: `GET /health` → returns 200 OK with JSON
  - Add simple verification endpoint: `GET /api/test` → returns sample JSON

- [ ] T038 [US3] Setup `src/BikeTracking.Api/appsettings.json` with:
  - Logging level configuration
  - CORS configuration to allow Frontend requests
  - API title/version

- [ ] T039 [US3] Configure `src/BikeTracking.Api/Properties/launchSettings.json` with:
  - Profile: "http" → use HTTP (no HTTPS required for local dev)
  - Application URL for local development

- [ ] T040 [US3] Configure AppHost to expose API port (from `T010`)

- [ ] T041 [US3] Add API Setup instructions to `README.md`:
  ```
  The API is automatically started by AppHost. 
  To run without AppHost:
  1. Navigate to src/BikeTracking.Api
  2. Run `dotnet run` 
  3. API will be available at http://localhost:[PORT]
  4. Health check: GET http://localhost:[PORT]/health
  ```

- [ ] T042 [US3] Add API test endpoint documentation to `README.md` API Endpoints section:
  - `GET /health` → Health check (returns 200)
  - `GET /api/test` → Sample endpoint (returns test data)

- [ ] T043 [P] [US3] Configure logging output that clearly shows:
  - Application startup message
  - Listening port
  - Loaded endpoints

- [ ] T044 [P] [US3] Setup CORS to allow Frontend access:
  - Configure in `Program.cs`
  - Allow requests from localhost:5173 (Frontend)
  - Document in `README.md`

- [ ] T045 [US3] Test end-to-end: run AppHost or direct `dotnet run` in API folder, verify `/health` endpoint responds

- [ ] T046 [P] [US3] Add API Troubleshooting to `README.md`:
  - "Port already in use" → instructions to find/change port
  - "CORS errors" → verify Frontend is allowed
  - "API not responding" → check AppHost or start manually

**Checkpoint**: API runs with callable health endpoint, responds in <2 seconds

---

## Phase 6: User Story 4 - Project Follows Modern .NET Conventions (Priority: P2)

**Goal**: Project demonstrates modern .NET practices and serves as a template for future features

**Independent Test**: Review project files: uses Aspire ✓, minimal APIs ✓, proper structure ✓, .NET 10+ ✓

### Implementation for US4

- [ ] T047 [US4] Verify .NET Aspire usage and document in `README.md`:
  - Explain AppHost orchestration
  - Show how to understand multi-service setup
  - Link to Aspire documentation

- [ ] T048 [US4] Document minimal APIs pattern in `README.md`:
  - Explain why minimal APIs chosen
  - Reference API Program.cs as example
  - Show how to add new endpoints

- [ ] T049 [US4] Document project structure rationale in `README.md` Architecture section:
  - Why 5 projects (separation of concerns)
  - Layer responsibilities
  - Integration points
  - Show dependency diagram

- [ ] T050 [US4] Add inline code comments to key files explaining pattern choices:
  - `src/BikeTracking.Api/Program.cs` → Minimal API setup
  - `src/BikeTracking.AppHost/AppHost.cs` → Aspire orchestration
  - `src/BikeTracking.ServiceDefaults/Extensions.cs` → Shared patterns

- [ ] T051 [P] [US4] Create `ARCHITECTURE.md` separate document explaining:
  - Application layers and responsibilities
  - Service communication patterns
  - How to add new features
  - How to add new services

- [ ] T052 [P] [US4] Document TypeScript/Vue patterns in Frontend:
  - Component structure
  - Type safety approach
  - Hot reload during development

- [ ] T053 [P] [US4] Document F# domain layer purpose in `README.md`:
  - Why included
  - Example of type-safe domain modeling
  - How it integrates with C# API

- [ ] T054 [US4] Create `CONTRIBUTING.md` with guidelines:
  - Project structure conventions
  - How to add endpoints
  - How to add frontend components
  - Development workflow

- [ ] T055 [US4] Verify solution uses latest .NET practices:
  - Top-level statements in Program.cs
  - Implicit namespaces configured
  - Modern async/await patterns ready

**Checkpoint**: Project serves as excellent template demonstrating modern .NET conventions

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, edge cases, and documentation completeness

- [ ] T056 [P] Complete edge case documentation in `README.md`:
  - Node.js version requirements explained
  - .NET version requirements explained
  - Port collision troubleshooting
  - Common startup issues and solutions

- [ ] T057 [P] Create `DEVELOPMENT.md` with:
  - Local development workflow
  - How to run each component independently
  - Debugging tips
  - Performance expectations

- [ ] T058 Verify all Success Criteria from spec.md are met:
  - SC-001: Setup takes <10 mins with README (⚠️ TEST THIS)
  - SC-002: `dotnet build` succeeds
  - SC-003: AppHost orchestrates without crashes
  - SC-004: Frontend displays hello screen in <5 seconds
  - SC-005: API /health responds in <2 seconds
  - SC-006: 5+ projects documented
  - SC-007: README enables 90% developer success (⚠️ TEST WITH FRESH CLONE)
  - SC-008: Uses Aspire, .NET 10+, minimal APIs

- [ ] T059 [P] Create `.github/ISSUE_TEMPLATE/` for future issues with project context
- [ ] T060 [P] Add GitHub Actions workflow placeholder (`.github/workflows/`) for future CI/CD

- [ ] T061 Test with actual fresh clone:
  - Clone the repository to new directory
  - Follow README from start
  - Time the setup (must be <10 minutes)
  - Verify build, AppHost startup, Frontend hello screen, API health check

- [ ] T062 [P] Final README quality pass:
  - Remove placeholder text
  - Verify all links work
  - Check grammar and clarity
  - Ensure code examples are accurate

- [ ] T063 Update `FEATURE_STATUS.md` or commit message documenting:
  - Scaffold complete ✅
  - Building blocks in place ✅
  - Ready for feature development ✅

**Checkpoint**: All success criteria verified, documentation complete, project ready for handoff to development teams

---

## Task Dependencies & Parallelization

### Phase 1-2: Sequential
- Must complete in order before Phase 3 begins
- Some tasks within phases can run in parallel (marked with [P])

### Phase 3-6: Parallel by User Story
- US1, US2, US3 can be implemented in parallel (all P1)
- US4 (P2) can start after US1, US2, US3 infrastructure is ready
- Tasks within each story can be parallelized (see [P] markers)

### Phase 7: Sequential
- Runs after all feature phases complete
- Final validation and testing

### Parallelization Summary

```
Phase 1-2 (Setup/Foundation) → BLOCKING
        ↓
        ├─ Phase 3 (US1: Project Structure) → Can run in parallel
        ├─ Phase 4 (US2: Frontend) → with US1, US3, US4
        ├─ Phase 5 (US3: API) ↓
        └─ Phase 6 (US4: Conventions) → After US1/US2/US3 started
        ↓
Phase 7 (Polish & Validation) → Final sequential validation
```

---

## MVP Scope

**Recommended MVP: Complete Phases 1-5 (all P1 stories)**

This delivers:
- ✅ Buildable project structure
- ✅ Runnable frontend with hello screen
- ✅ Runnable API with health check
- ✅ Orchestration with AppHost
- ✅ Documentation for developer setup

**Phase 6 (P2)** can follow in a polish iteration, as it's documentation-heavy and lower priority.

---

## File Locations Summary

| File | Purpose | Status |
|------|---------|--------|
| `BikeTracking.slnx` | Solution file | Existing → Verify (T001) |
| `README.md` | Setup documentation | Create → Build throughout |
| `src/BikeTracking.Api/Program.cs` | API endpoints | Scaffold (T037) |
| `src/BikeTracking.Api/appsettings.json` | API config | Configure (T038) |
| `src/BikeTracking.Frontend/src/my-app.html` | Hello screen | Create (T028) |
| `src/BikeTracking.Frontend/vite.config.ts` | Frontend build | Verify (T029) |
| `src/BikeTracking.AppHost/AppHost.cs` | Service orchestration | Configure (T009-T012) |
| `src/BikeTracking.ServiceDefaults/Extensions.cs` | Shared config | Setup (T006-T008) |
| `ARCHITECTURE.md` | Architecture overview | Create (T051) |
| `CONTRIBUTING.md` | Contribution guide | Create (T054) |
| `DEVELOPMENT.md` | Dev workflow | Create (T057) |
| `global.json` | .NET version | Verify (T003) |
| `.gitignore` | Build artifacts | Update (T002) |

---

## Success Checklist

By end of Phase 7, verify:

- [ ] `dotnet build` compiles all projects without errors
- [ ] `dotnet run` in `src/BikeTracking.AppHost` starts all services
- [ ] API health check: `curl http://localhost:[PORT]/health` returns 200
- [ ] Frontend: `npm run dev` in `src/BikeTracking.Frontend` shows hello screen at http://localhost:5173
- [ ] README provides clear, working setup instructions
- [ ] Fresh clone can achieve full setup in <10 minutes
- [ ] All 5 projects have documented purpose
- [ ] All user story requirements from spec.md verified

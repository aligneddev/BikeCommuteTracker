# Tasks: Advanced Statistics Dashboard

**Input**: Spec 018 with 4 user stories (P1/P2), plan.md, research.md, data-model.md, contracts/
**Prerequisites**: DevContainer running, existing tests passing, spec clarifications complete

**Approach**: Tasks organized by user story for parallel independent delivery; TDD workflow (RED → GREEN → REFACTOR) applied to each story; all tests written before implementation.

---

## Format

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[US#]**: User story (US1, US2, US3, US4)
- **File paths**: Exact locations per plan.md structure

---

## Phase 1: Setup — Backend Contracts & Scaffolding

**Purpose**: Foundational code structure for all user stories

- [X] T00- [X] T001 Create `src/BikeTracking.Api/Contracts/AdvancedDashboardContracts.cs` with all response records (AdvancedDashboardResponse, AdvancedSavingsWindow, AdvancedDashboardSuggestion, AdvancedDashboardReminders)
- [X] T00- [X] T002 Create `src/BikeTracking.Api/Application/Dashboard/GetAdvancedDashboardService.cs` scaffold with empty `GetAsync(long riderId, CancellationToken)` method
- [X] T00- [X] T003 [P] Register `GetAdvancedDashboardService` in `src/BikeTracking.Api/Program.cs` DI container (same pattern as GetDashboardService)
- [X] T00- [X] T004 Add `GET /api/dashboard/advanced` route in `src/BikeTracking.Api/Endpoints/DashboardEndpoints.cs` (requires authorization, returns AdvancedDashboardResponse)
- [X] T00- [X] T005 [P] Create `src/BikeTracking.Frontend/src/services/advanced-dashboard-api.ts` with typed `getAdvancedDashboard(token: string): Promise<AdvancedDashboardResponse>` function

---

## Phase 2: Foundational — F# Pure Calculation Helpers

**Purpose**: Reusable pure functions for all stories; tested independently before use in service

- [X] T00- [X] T006 Create `src/BikeTracking.Domain.FSharp/AdvancedDashboardCalculations.fs` with pure functions:
  - `calculateGallonsSaved: RideSnapshot list -> decimal option` (using SnapshotAverageCarMpg)
  - `calculateFuelCostAvoided: RideSnapshot list -> GasPriceSnapshot list -> (decimal option * bool)` (value + estimated flag)
  - `calculateMileageRateSavings: RideSnapshot list -> decimal option` (using SnapshotMileageRateCents)
  - All functions tested independently; return Result<'T, Error> on errors
- [X] T00- [X] T007 [P] Create `src/BikeTracking.Api.Tests/Application/Dashboard/GetAdvancedDashboardServiceTests.cs` with failing RED tests for pure calculation helpers before T006 implementation

---

## Phase 3: User Story 1 — View Aggregate Fuel and Cost Savings (P1)

**Goal**: User sees total gallons saved, fuel cost avoided (with estimated flag), and mileage-rate savings for all-time history

**Independent Test**: Navigate to `/dashboard/advanced`, verify all-time savings displayed correctly, reminder cards shown when settings missing

### Tests (RED first)

- [X] T00- [X] T008 [P] [US1] Backend test: `GetAdvancedDashboardService_WithRidesInMultipleYears_ReturnsCorrectAllTimeGallonsSaved` in `src/BikeTracking.Api.Tests/Application/Dashboard/GetAdvancedDashboardServiceTests.cs`
- [X] T00- [X] T009 [P] [US1] Backend test: `GetAdvancedDashboardService_WithRideMissingGasPrice_FlagsFuelCostEstimatedTrue` in same file
- [X] T010 [P] [US1] Backend test: `GetAdvancedDashboardService_UserWithNoMpgSetting_ReturnsMpgReminderRequired` in same file
- [X] T011 [P] [US1] Backend test: `GetAdvancedDashboardService_UserWithNoMileageRateSetting_ReturnsMileageRateReminderRequired` in same file
- [X] T012 [P] [US1] Frontend test: `AdvancedDashboardPage_OnLoad_DisplaysAllTimeSavingsCorrectly` in `src/BikeTracking.Frontend/src/pages/advanced-dashboard/advanced-dashboard-page.test.tsx`
- [X] T013 [P] [US1] Frontend test: `AdvancedDashboardPage_MpgReminderRequired_ShowsReminderCard` in same file
- [X] T014 [P] [US1] Frontend test: `AdvancedDashboardPage_MileageRateReminderRequired_ShowsReminderCard` in same file

**Confirm all tests RED before proceeding to implementation**

### Implementation (GREEN)

- [X] T015 [US1] Implement `GetAdvancedDashboardService.GetAsync()` core logic:
  - Load all user rides, UserSettings, and GasPriceLookups in one async batch
  - Filter rides to all-time (no date filter)
  - Compute gallons saved, fuel cost avoided, mileage-rate savings using pure F# helpers from T006
  - Build reminder flags from UserSettings nullability
  - Return `AdvancedDashboardResponse` with all-time window populated
- [X] T016 [P] [US1] Create `src/BikeTracking.Frontend/src/pages/advanced-dashboard/advanced-dashboard-page.tsx` component:
  - Call `getAdvancedDashboard()` on mount, handle loading/error states
  - Render reminder cards for MPG and mileage-rate when flags set
  - Render all-time savings summary (gallons, fuel cost with estimated badge, mileage rate)
  - Add `<link to="/dashboard">← Back</link>` footer
- [X] T017 [P] [US1] Create `src/BikeTracking.Frontend/src/pages/advanced-dashboard/advanced-dashboard-page.css` with card styles (reuse existing dashboard CSS patterns, no new Tailwind)
- [X] T018 [US1] Create `src/BikeTracking.Frontend/src/pages/advanced-dashboard/SavingsWindowsTable.tsx` component scaffold (stub for multi-window table)
- [X] T019 [US1] Add route in `src/BikeTracking.Frontend/src/App.tsx` inside `ProtectedRoute`: `<Route path="/dashboard/advanced" element={<AdvancedDashboardPage />} />`

**Run tests**: `dotnet test ... GetAdvancedDashboardService` and `npm run test:unit` — confirm all GREEN

**Checkpoint**: All-time savings visible; reminders functional

---

## Phase 4: User Story 2 — View Savings Rate Metrics (P1)

**Goal**: User sees savings broken into weekly, monthly, yearly, all-time windows, each with own gallons/fuel/mileage rates and estimated flags

**Independent Test**: Verify week/month/year values differ correctly based on ride dates; navigate to advanced dashboard, see 4-row table

### Tests (RED first)

- [X] T020 [P] [US2] Backend test: `GetAdvancedDashboardService_WithRidesInMultipleWindows_ReturnsCorrectGallonsSavedPerWindow` in `src/BikeTracking.Api.Tests/Application/Dashboard/GetAdvancedDashboardServiceTests.cs`
- [X] T021 [P] [US2] Backend test: `GetAdvancedDashboardService_PartialMonthRides_HandlesZeroDivisionGracefully` in same file
- [X] T022 [P] [US2] Frontend test: `SavingsWindowsTable_WithMultipleWindows_RendersFourRows` in `src/BikeTracking.Frontend/src/pages/advanced-dashboard/SavingsWindowsTable.test.tsx`
- [X] T023 [P] [US2] Frontend test: `SavingsWindowsTable_FuelCostEstimated_ShowsEstimatedBadge` in same file
- [X] T024 [P] [US2] Frontend test: `AdvancedDashboardPage_AllWindowsPopulated_TablesVisible` in `src/BikeTracking.Frontend/src/pages/advanced-dashboard/advanced-dashboard-page.test.tsx`

**Confirm all tests RED**

### Implementation (GREEN)

- [X] T025 [US2] Extend `GetAdvancedDashboardService.GetAsync()` to compute 4 time windows:
  - Weekly: current calendar week (Monday–Sunday ISO)
  - Monthly: current calendar month
  - Yearly: current calendar year
  - All-time: (already done in T015)
  - For each window: compute gallons, fuel cost (+ estimated flag), mileage rate, combined
  - Return `AdvancedDashboardResponse` with all windows populated
- [X] T026 [P] [US2] Implement `SavingsWindowsTable.tsx`: render 4-row table (weekly/monthly/yearly/all-time), each row shows miles, gallons, fuel cost (with "Estimated" badge when flagged), mileage rate, combined
- [X] T027 [P] [US2] Create `src/BikeTracking.Frontend/src/pages/advanced-dashboard/SavingsWindowsTable.test.tsx` with tests from T022, T023
- [X] T028 [US2] Update `advanced-dashboard-page.tsx` to render `<SavingsWindowsTable>` component below all-time summary

**Run tests**: `dotnet test ... GetAdvancedDashboardService` and `npm run test:unit` — confirm all GREEN

**Checkpoint**: 4-window breakdown complete and testable

---

## Phase 5: User Story 3 — See Personalized Sustainability Suggestions (P2)

**Goal**: User sees 3 deterministic rule-based suggestions (consistency, milestone, comeback) with IsEnabled flags based on ride patterns

**Independent Test**: Verify consistency suggestion enabled when ≥1 ride this week; milestone enabled when savings cross $50; comeback enabled when >7 days since last ride

### Tests (RED first)

- [X] T029 [P] [US3] Backend test: `GetAdvancedDashboardService_RideThisWeek_ConsistencySuggestionEnabled` in `src/BikeTracking.Api.Tests/Application/Dashboard/GetAdvancedDashboardServiceTests.cs`
- [X] T030 [P] [US3] Backend test: `GetAdvancedDashboardService_CombinedSavingsExceed50_MilestoneSuggestionEnabled` in same file
- [X] T031 [P] [US3] Backend test: `GetAdvancedDashboardService_LastRideMoreThan7DaysAgo_ComebackSuggestionEnabled` in same file
- [X] T032 [P] [US3] Frontend test: `AdvancedSuggestionsPanel_WithEnabledSuggestions_ShowsCards` in `src/BikeTracking.Frontend/src/pages/advanced-dashboard/AdvancedSuggestionsPanel.test.tsx`
- [X] T033 [P] [US3] Frontend test: `AdvancedSuggestionsPanel_DisabledSuggestion_NotRendered` in same file
- [X] T034 [P] [US3] Frontend test: `AdvancedDashboardPage_SuggestionsVisible_RendersPanel` in `advanced-dashboard-page.test.tsx`

**Confirm all tests RED**

### Implementation (GREEN)

- [X] T035 [US3] Extend `GetAdvancedDashboardService.GetAsync()` to build 3 suggestions:
  - Consistency: enabled if weekly rideCount ≥ 1
  - Milestone: enabled if any of ($10, $50, $100, $500) thresholds crossed in all-time combined savings
  - Comeback: enabled if (now - lastRide.date).Days > 7 && totalRideCount ≥ 1
  - Return suggestions in response with IsEnabled flags
- [X] T036 [P] [US3] Create `src/BikeTracking.Frontend/src/pages/advanced-dashboard/AdvancedSuggestionsPanel.tsx` component:
  - Render only enabled suggestions as cards
  - Show title + description for each (consistency, milestone, comeback)
  - Hide disabled suggestions
- [X] T037 [P] [US3] Create `AdvancedSuggestionsPanel.test.tsx` with tests from T032, T033
- [X] T038 [US3] Update `advanced-dashboard-page.tsx` to render `<AdvancedSuggestionsPanel>` component below savings table

**Run tests**: `dotnet test` and `npm run test:unit` — confirm all GREEN

**Checkpoint**: Suggestions generated and displayed

---

## Phase 6: User Story 4 — Navigate to Advanced Dashboard from Main Dashboard (P1)

**Goal**: User can reach advanced dashboard via card link on main dashboard AND via top nav "Advanced Stats" link; session preserved

**Independent Test**: Click link from main dashboard, navigate to `/dashboard/advanced`, verify URL and content load; back button returns to main dashboard

### Tests (RED first)

- [X] T039 [P] [US4] Frontend test: `DashboardPage_AdvancedStatsLink_NavigatesToAdvancedDashboard` in `src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.test.tsx`
- [X] T040 [P] [US4] Frontend test: `AppHeader_AdvancedStatsNavLink_NavigatesToAdvancedDashboard` in `src/BikeTracking.Frontend/src/components/app-header/app-header.test.tsx` (or similar)
- [X] T041 [P] [US4] E2E test: `Navigate from main dashboard to advanced dashboard via card link` in `tests/e2e/advanced-dashboard.spec.ts`
- [X] T042 [P] [US4] E2E test: `Navigate via top nav Advanced Stats link` in same file

**Confirm all tests RED**

### Implementation (GREEN)

- [X] T043 [P] [US4] Update `src/BikeTracking.Frontend/src/components/app-header/app-header.tsx`:
  - Add `NavLink` to `/dashboard/advanced` labeled "Advanced Stats" after existing "Dashboard" NavLink
  - Use same `nav-link` CSS class pattern for consistency
- [X] T044 [P] [US4] Update `src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.tsx`:
  - Add `<Link to="/dashboard/advanced">View Advanced Stats →</Link>` card-action below MoneySaved summary section
  - Style as secondary card action using existing CSS classes (no new CSS)
- [X] T045 [US4] Verify navigation session preserved (auth token persists, no unexpected reloads) — test manually or via E2E

**Run tests**: E2E tests `npm run test:e2e` — confirm all GREEN

**Checkpoint**: Both navigation entry points functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Code quality, formatting, documentation, full integration

### Tests & Validation

- [X] T046 Run full backend test suite: `dotnet test BikeTracking.slnx`
- [X] T047 Run full frontend test suite: `npm run test:unit --prefix src/BikeTracking.Frontend && npm run test:e2e --prefix src/BikeTracking.Frontend`
- [X] T048 Verify backend lint/build: `dotnet build BikeTracking.slnx && csharpier format .` (must be clean)
- [X] T049 Verify frontend lint/build: `npm run lint --prefix src/BikeTracking.Frontend && npm run build --prefix src/BikeTracking.Frontend` (must be clean)

### Code Quality

- [X] T050 Refactor shared calculation helpers in `GetAdvancedDashboardService` and `GetDashboardService` if duplication detected (extract only if genuine reuse exists)
- [X] T051 [P] Add XML documentation comments to all public methods in `GetAdvancedDashboardService`, `AdvancedDashboardContracts`, and F# helpers
- [X] T052 [P] Add TypeScript JSDoc comments to `advanced-dashboard-api.ts` and all component exports
- [X] T053 [P] Add inline comments explaining time-window bucketing logic in service (calendar vs rolling rationale)

### Documentation

- [X] T054 Verify all references in research.md (decisions 1–6) are reflected in implementation comments
- [X] T055 Update quickstart.md with any deviations from plan (if any)
- [X] T056 [P] Add README.md entry under "Features" → "Advanced Statistics Dashboard" with link to `/dashboard/advanced`

### Finalization

- [X] T057 Rebase branch on `main`: `git rebase origin/main`
- [~] T058 Create Pull Request with reference to GitHub issue (spec 018)
- [~] T059 Request Copilot code review on PR
- [~] T060 Address review feedback; ensure all checks pass before merge

---

## Phase 8: User Story 5 — Expenses in Savings Breakdown (FR-016–FR-020)

**Goal**: Each time window shows total expenses (by ExpenseDate), oil-change savings offset (windowed by cumulative mile intervals), and net savings (combined savings + oil-change savings − expenses, can be negative).

**Independent Test**: Verify that recording a $50 expense in the current month makes the monthly net savings decrease by $50. Verify that a user with no oil change price configured sees null for oil-change savings but still sees total expenses and net savings.

### Tests (RED first)

- [X] T061 [P] [US5] Backend test: `GetAdvancedDashboardService_WithExpensesInWindow_IncludesExpensesInCorrectWindow`
- [X] T062 [P] [US5] Backend test: `GetAdvancedDashboardService_WithExpenses_NetSavingsIsCombinedMinusExpenses`
- [X] T063 [P] [US5] Backend test: `GetAdvancedDashboardService_ExpensesExceedSavings_NetSavingsIsNegative`
- [X] T064 [P] [US5] Backend test: `GetAdvancedDashboardService_WithOilChangePrice_IncludesWindowedOilChangeSavings`
- [X] T065 [P] [US5] Backend test: `GetAdvancedDashboardService_WithNoOilChangePrice_OilChangeSavingsIsNull`
- [X] T066 [P] [US5] Frontend test: `SavingsWindowsTable_WithExpenses_ShowsExpensesAndNetSavingsColumns`
- [X] T067 [P] [US5] Frontend test: `SavingsWindowsTable_NegativeNetSavings_AppliesRedStyle`

**Confirm all tests RED before implementation**

### Implementation (GREEN)

- [X] T068 [US5] Update `AdvancedDashboardContracts.cs` — add to `AdvancedSavingsWindow`: `TotalExpenses: decimal`, `OilChangeSavings: decimal?`, `NetSavings: decimal?`
- [X] T069 [US5] Update `GetAdvancedDashboardService.GetAsync()`:
  - Load all non-deleted expenses for user alongside rides
  - For each window: sum expenses with `ExpenseDate` within window boundaries
  - For each window: compute windowed oil-change savings using cumulative-miles interval crossing formula
  - Compute `NetSavings` per window
- [X] T070 [P] [US5] Update `advanced-dashboard-api.ts` — add `totalExpenses`, `oilChangeSavings`, `netSavings` to `AdvancedSavingsWindow` interface
- [X] T071 [P] [US5] Update `SavingsWindowsTable.tsx` — add Expenses, Oil Change Savings, Net Savings columns; apply red class when `netSavings < 0`
- [X] T072 [P] [US5] Update `advanced-dashboard-page.css` — add `.savings-windows-negative` rule for red negative net savings

**Run tests**: `dotnet test ... GetAdvancedDashboardService` and `npm run test:unit` — confirm all GREEN

---

### Critical Path (Must Complete in Order)

T001–T005 (Setup) → T006–T007 (Foundational) → T008–T019 (US1) → Remaining stories can proceed in parallel

### Parallel Opportunities

- **Phase 3 (US1 tests)**: T008–T014 can all run in parallel
- **Phase 3 (US1 impl)**: T016–T018 can run in parallel (marked [P])
- **Phase 4 (US2)**: T020–T024 (tests), then T026–T027 (impl [P]) in parallel
- **Phase 5 (US3)**: T029–T034 (tests), then T036–T037 (impl [P]) in parallel
- **Phase 6 (US4)**: T039–T042 (tests), then T043–T044 (impl [P]) in parallel
- **Phase 7**: T051–T052 (docs [P]) in parallel with other polish tasks

### Example Execution Plan (7 Days)

| Day | Tasks | Rationale |
|-----|-------|-----------|
| 1 | T001–T007 | Setup + foundational infrastructure |
| 2 | T008–T019 (US1) | Core MVP — aggregate savings |
| 3 | T020–T038 (US2 + US3 parallel) | Time windows + suggestions |
| 4 | T039–T045 (US4) + refactoring | Navigation + cross-cutting fixes |
| 5 | T046–T060 (validation + docs) | Quality gates, PR, review |
| 6 | Feedback & refinement | Address PR review if needed |
| 7 | Merge & deployment prep | Ready for release |

---

## Success Criteria (Definition of Done)

- [ ] All 60 tasks complete and marked done
- [ ] All tests pass locally and in CI
- [ ] Code lint, format, and build clean
- [ ] No regressions on existing dashboard or ride history features
- [ ] E2E tests verify full user journey (navigate → view stats → navigate back)
- [ ] PR approved and merged to `main`
- [ ] Feature is deployable immediately post-merge

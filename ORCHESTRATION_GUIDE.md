# Task Orchestration Guide: Advanced Dashboard (Spec 018)

## Overview

The parallel task orchestrator automates execution of dependent and independent tasks for the Advanced Statistics Dashboard feature. It leverages PowerShell job pools to run parallelizable tasks simultaneously while respecting critical-path sequencing.

**Configuration**: `.specify/scripts/powershell/task-parallel-groups.json`  
**Orchestrator**: `.specify/scripts/powershell/orchestrate-parallel-tasks.ps1`

---

## Quick Start

### Run All Phases
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase all
```

### Run Specific Phase
```bash
# Phase 1 (Setup) - foundational infrastructure
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 1

# Phase 3 (US1 - Aggregate Savings) - core MVP
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 3

# Phases 4-5 in parallel (US2 + US3)
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 4
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 5  # Run in separate terminal
```

### Run Specific Task Group
```bash
# Phase 3 tests only (all 7 tests run in parallel)
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -GroupName Phase3_Tests

# Phase 3 implementation (sequential)
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -GroupName Phase3_Implementation
```

### With Verbose Logging
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 3 -Verbose
```

### Continue on Error (Don't Fail Fast)
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase all -ContinueOnError
```

---

## Copilot CLI Usage

### Query Task Status
```bash
# Ask Copilot to explain the parallel structure
gh copilot explain ".specify/scripts/powershell/task-parallel-groups.json"

# Ask about a specific phase
gh copilot explain "Explain Phase 3 of the task orchestration for spec 018"
```

### Execute via Copilot Suggestions
```bash
# Get Copilot's suggestion for running Phase 1
gh copilot suggest "Run Phase 1 setup for advanced dashboard"
# Output: pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 1

# Get suggestion for running tests in parallel
gh copilot suggest "Run all Phase 3 tests in parallel for advanced dashboard"
# Output: pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 3 -GroupName Phase3_Tests
```

### Shell Alias (Optional)

Add to your shell profile (`.bashrc`, `.zshrc`, or PowerShell `$PROFILE`):

```bash
# Bash / Zsh
alias spec-tasks="pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1"

# Usage:
spec-tasks -Phase 1
spec-tasks -Phase all -Verbose
```

---

## Task Group Structure

### Phase 1: Setup (Sequential)
**Tasks**: T001–T005  
**Duration**: ~1–2 hours  
**Parallelization**: None — each task builds on the previous  
**Deliverables**: Contracts, service scaffold, endpoint, API client  

```
T001 → T002 → T003 → T004 → T005
```

### Phase 2: Foundational (Sequential)
**Tasks**: T006–T007  
**Duration**: ~1–2 hours  
**Parallelization**: None — T007 depends on T006 structure  
**Deliverables**: F# pure functions, failing tests  

```
T006 → T007
```

### Phase 3: US1 — Aggregate Savings (Tests Parallel, Then Implementation Sequential)
**Tests**: T008–T014 (7 tests, **all parallel**)  
**Implementation**: T015–T019 (5 tasks, sequential)  
**Duration**: ~2–3 hours  
**Deliverables**: Core MVP — all-time savings, reminders, API endpoint working  

```
[T008, T009, T010, T011, T012, T013, T014] (parallel)
        ↓
T015 → T016 → T017 → T018 → T019
```

### Phase 4: US2 — Time Windows (Tests Parallel, Then Implementation Sequential)
**Tests**: T020–T024 (5 tests, **all parallel**)  
**Implementation**: T025–T027 (3 tasks, sequential)  
**Duration**: ~2–3 hours  
**Deliverables**: Multi-window savings table, rate metrics  

```
[T020, T021, T022, T023, T024] (parallel)
        ↓
T025 → T026 → T027
```

### Phase 5: US3 — Suggestions (Tests Parallel, Then Implementation Sequential)
**Tests**: T029–T033 (5 tests, **all parallel**)  
**Implementation**: T034–T038 (5 tasks, sequential)  
**Duration**: ~2–3 hours  
**Deliverables**: Rule-based suggestions, suggestion panel  

```
[T029, T030, T031, T032, T033] (parallel)
        ↓
T034 → T035 → T036 → T037 → T038
```

### Phase 6: US4 — Navigation (Tests Parallel, Impl Parallel)
**Tests**: T039–T042 (4 tests, **all parallel**)  
**Implementation**: T043–T045 (3 tasks, **T043–T044 parallel**)  
**Duration**: ~1–2 hours  
**Deliverables**: Card action link + top nav link  

```
[T039, T040, T041, T042] (parallel)
        ↓
[T043, T044] (parallel) → T045
```

### Phase 7: Polish (Quality Gates Sequential, Docs Parallel, Git Sequential)
**Quality Gates**: T046–T049 (4 tasks, sequential)  
**Documentation**: T051–T053 (3 tasks, **parallel**)  
**Git/Review**: T057–T060 (4 tasks, sequential)  
**Duration**: ~2–3 hours  
**Deliverables**: Passing tests, clean lint, merged PR  

```
[T046, T047, T048, T049] (sequential quality gates)
        ↓
[T051, T052, T053] (parallel docs)
        ↓
T057 → T058 → T059 → T060
```

---

## Execution Roadmap (7-Day Example)

| Day | Phase(s) | Tasks | Parallel Groups | Duration | Checkpoint |
|-----|----------|-------|-----------------|----------|------------|
| 1   | 1–2      | T001–T007 | None (sequential) | 2–3h | Service scaffold complete; F# helpers + tests passing RED |
| 2   | 3        | T008–T019 | Tests [P], Tests RED, Impl sequential | 2–3h | US1 MVP working; all-time savings displayed; reminders showing |
| 3   | 4 + 5    | T020–T038 | US2 Tests [P], US3 Tests [P] (parallel phases) | 3–4h | Multi-window table + suggestions working |
| 4   | 6 + 7.1  | T039–T049 | US4 Tests [P], Nav Impl [P], Quality Tests [sequential] | 2–3h | Navigation functional; full test suite passing |
| 5   | 7.2      | T051–T053 | Docs [P] | 1h | Code fully documented |
| 6   | 7.3 + PR Review | T057–T060 | Git workflow + review feedback | 1–2h | Ready for merge |
| 7   | Deployment | Merge to main | – | 1h | Feature released |

**Total Effort**: ~5–7 days solo developer (or 2–3 days with 2–3 developers executing phases in parallel)

---

## Commands for Key Workflows

### TDD Red-Green-Refactor Cycle

```bash
# Day 1: Phase 1-2 (setup)
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 1
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 2

# Day 2: Phase 3 RED tests
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 3 -GroupName Phase3_Tests
# ✓ Verify all tests RED (failing for correct reasons)

# Then: Phase 3 GREEN implementation
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 3 -GroupName Phase3_Implementation
# ✓ Verify all tests GREEN

# Repeat for Phase 4, 5, 6
```

### Developer Workflow (Parallel Development)

**Developer A** (Frontend):
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 4 -GroupName Phase4_Tests
# Then locally implement T026, T027 (SavingsWindowsTable component)
```

**Developer B** (Backend):
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 5 -GroupName Phase5_Tests
# Then locally implement T034, T035 (Suggestion logic + F# helpers)
```

Both developers can work in parallel after Phase 1–3 complete.

### Quality Gate Pre-PR

```bash
# Before creating PR, run full quality gates
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 7

# If any fails, fix locally, then re-run quality gates
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 7 -GroupName Phase7_QualityGates
```

---

## Configuration Reference

### task-parallel-groups.json Structure

```json
{
  "version": "1.0",
  "featureId": "018-advanced-dashboard",
  "taskGroups": [
    {
      "phase": 1,
      "name": "Phase1_Setup",
      "description": "...",
      "parallel": false,  // or true
      "tasks": [
        "T001: Description",
        "T002: Description",
        ...
      ],
      "notes": "..."
    }
  ]
}
```

**Fields**:
- `phase`: Integer 1–7
- `name`: Unique identifier (e.g., `Phase3_Tests`)
- `description`: Short summary of group purpose
- `parallel`: Boolean — if true, all tasks run simultaneously via PowerShell jobs
- `tasks`: Array of task descriptions (not executed yet; placeholders for future integration)
- `notes`: Dependency or sequencing notes

### Modifying Configuration

To add a new task group or adjust parallelization:

1. Edit `task-parallel-groups.json`
2. Add new object to `taskGroups` array
3. Set `parallel: true` for task groups that can run simultaneously
4. Verify `executionSequence` and `criticalPath` sections are still accurate
5. Run orchestrator with `-Verbose` to validate

---

## Troubleshooting

### Jobs Fail to Start
```powershell
# Verify PowerShell execution policy allows jobs
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Test job creation manually
Start-Job -ScriptBlock { "test" } | Receive-Job
```

### Configuration Not Found
```bash
# Verify file exists
ls ./.specify/scripts/powershell/task-parallel-groups.json

# Check JSON validity
pwsh -Command "Get-Content ./.specify/scripts/powershell/task-parallel-groups.json | ConvertFrom-Json"
```

### Job Hangs or Times Out
- Add timeout logic to orchestrator (currently runs indefinitely)
- Increase `Start-Sleep` duration in placeholder task logic to test long-running jobs

---

## Future Enhancements

1. **Actual Task Integration**: Replace placeholder task execution with real commands:
   - Backend tests: `dotnet test ...`
   - Frontend tests: `npm run test:unit ...`
   - Build/lint: `dotnet build ...`, `npm run lint ...`
   - File creation: Actual file generation logic

2. **Job Timeout Handling**: Add per-job timeout thresholds; automatically fail if exceeded

3. **Logging & Artifacts**: Capture job output to timestamped log files for post-execution review

4. **Conditional Execution**: Skip tasks based on file existence (e.g., if `GetAdvancedDashboardService.cs` already exists, skip T002)

5. **Progress Dashboard**: Web UI or terminal dashboard showing real-time job progress

6. **Multi-Machine Orchestration**: Distribute jobs across multiple developer machines via SSH/remoting

---

## Contact & Questions

For questions about orchestration or task dependencies, refer to:
- **Spec**: `specs/018-advanced-dashboard/spec.md`
- **Plan**: `specs/018-advanced-dashboard/plan.md`
- **Tasks**: `specs/018-advanced-dashboard/tasks.md`
- **Analysis**: Run consistency check — `gh copilot explain specs/018-advanced-dashboard`

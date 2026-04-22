# Quick Reference: Task Orchestration Commands

## Most Common Commands

### Run Phase 1 (Setup - Foundation)
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 1
```
**Duration**: ~1–2 hours | **Deliverable**: Service scaffold, contracts, endpoint

### Run Phase 3 (US1 - Core MVP)
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 3
```
**Duration**: ~2–3 hours | **Deliverable**: All-time savings, reminders, API working

### Run Phase 4 (US2 - Time Windows)
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 4
```
**Duration**: ~2–3 hours | **Deliverable**: Multi-window table, rate metrics

### Run Phase 5 (US3 - Suggestions)
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 5
```
**Duration**: ~2–3 hours | **Deliverable**: Rule-based suggestions, UI panel

### Run Phase 6 (US4 - Navigation)
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 6
```
**Duration**: ~1–2 hours | **Deliverable**: Card action + top nav links

### Run Phase 7 (Quality & Polish)
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 7
```
**Duration**: ~2–3 hours | **Deliverable**: Passing tests, merged PR

### Run Everything (All Phases)
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase all
```
**Duration**: ~5–7 days (one developer) | **Deliverable**: Complete feature

---

## Copilot CLI Usage

### Explain the Task Structure
```bash
gh copilot explain "task-parallel-groups.json in .specify/scripts/powershell/"
```

### Get Command Suggestion
```bash
gh copilot suggest "Run Phase 3 tests in parallel for advanced dashboard"
```

### Ask About Execution Plan
```bash
gh copilot explain "What is the critical path for spec 018 advanced dashboard implementation?"
```

---

## Testing-Focused Commands

### Run All Phase 3 Tests (Parallel)
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -GroupName Phase3_Tests
```
Runs all 7 unit/frontend tests in parallel before implementation.

### Run US1 Implementation After RED Tests Pass
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -GroupName Phase3_Implementation
```

### Verbose Output (Debug)
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 3 -Verbose
```

### Don't Fail on First Error (Continue Testing)
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 3 -ContinueOnError
```

---

## Developer Workflows

### Full TDD Cycle (Red → Green → Refactor)
```bash
# 1. Create failing tests
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 1
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 2

# 2. Run Phase 3 tests (should all RED)
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 3 -GroupName Phase3_Tests

# 3. Implement until tests GREEN
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 3 -GroupName Phase3_Implementation

# 4. Repeat for Phases 4, 5, 6
```

### Parallel Development (Team)
```bash
# Developer A: Frontend tests & implementation
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 4 -GroupName Phase4_Tests

# Developer B (in separate terminal): Backend tests & implementation
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 5 -GroupName Phase5_Tests

# Both can proceed in parallel after Phase 1-3 complete
```

### Pre-PR Quality Check
```bash
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 7
```
Runs all quality gates before submitting PR.

---

## Multi-Terminal Setup

Open 4–6 terminals for efficient parallel work:

```bash
# Terminal 1: Watch backend tests (real-time)
dotnet watch test src/BikeTracking.Api.Tests/BikeTracking.Api.Tests.csproj

# Terminal 2: Watch frontend tests (real-time)
cd src/BikeTracking.Frontend && npm run test:unit:watch

# Terminal 3: Backend build watch
dotnet watch build src/BikeTracking.Api/BikeTracking.Api.csproj

# Terminal 4: Frontend dev server
cd src/BikeTracking.Frontend && npm run dev

# Terminal 5: Orchestrator commands
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 3 -Verbose

# Terminal 6: Git/PR operations
git status && git log --oneline -5
```

---

## Bash Alias (Optional - Add to ~/.bashrc or ~/.zshrc)

```bash
alias spec-tasks="pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1"

# Usage:
spec-tasks -Phase 1
spec-tasks -Phase 3 -Verbose
spec-tasks -Phase all -ContinueOnError
```

Or PowerShell (Add to $PROFILE):

```powershell
function Invoke-SpecTasks {
    param([string]$Phase = 'all')
    pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase $Phase @args
}

Set-Alias -Name spec-tasks -Value Invoke-SpecTasks
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Config file not found" | Verify `.specify/scripts/powershell/task-parallel-groups.json` exists |
| "Tasks not executing" | Check PowerShell execution policy: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| "Jobs hang" | Add `-Verbose` flag; check task logic in orchestrator script |
| "Need to skip to Phase 4" | Run: `pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -Phase 4` (no dependency check yet) |

---

## Full Feature Timeline (7 Days Solo)

| Day | Command | Duration | Output |
|-----|---------|----------|--------|
| 1 | `spec-tasks -Phase 1` | 1–2h | Service scaffold ✓ |
| 1 | `spec-tasks -Phase 2` | 1h | F# helpers + tests RED ✓ |
| 2 | `spec-tasks -Phase 3` | 2–3h | US1 MVP: all-time savings ✓ |
| 3 | `spec-tasks -Phase 4` | 2–3h | US2: multi-window table ✓ |
| 3 | `spec-tasks -Phase 5` | 2–3h | US3: suggestions (parallel with Phase 4) |
| 4 | `spec-tasks -Phase 6` | 1–2h | US4: navigation links ✓ |
| 5 | `spec-tasks -Phase 7` | 2–3h | Quality gates, docs, PR ✓ |

---

## Get Help

```bash
# View orchestrator help
pwsh ./.specify/scripts/powershell/orchestrate-parallel-tasks.ps1 -?

# View full guide
cat ORCHESTRATION_GUIDE.md

# Ask Copilot
gh copilot explain "orchestration guide for spec 018"
```

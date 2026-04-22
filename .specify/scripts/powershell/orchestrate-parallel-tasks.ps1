#!/usr/bin/env pwsh
<#!
.SYNOPSIS
Orchestrate parallel task execution for advanced-dashboard feature (spec 018)

.DESCRIPTION
Executes task groups concurrently based on dependency ordering. Each group represents
a set of tasks that can run in parallel without blocking each other.

Workflow:
1. Load task configuration from task-parallel-groups.json
2. Validate Phase and task selection
3. Execute groups sequentially; within each group, tasks run in parallel via PowerShell jobs
4. Monitor job completion; report results
5. Fail fast if any task fails (unless -ContinueOnError specified)

Groups are ordered by phase and dependency:
- Phase 1-2: Sequential (setup + foundational)
- Phase 3+: Parallelized by story (tests, then implementation per phase)

.PARAMETER Phase
Phase to execute: 'all', 1, 2, 3, 4, 5, 6, 7. Default: 'all'

.PARAMETER GroupName
Optionally target a specific group (e.g., 'Phase3_Tests'). If omitted, runs all groups.

.PARAMETER ContinueOnError
If true, continue executing remaining tasks even if one fails. Default: false (fail fast)

.PARAMETER Verbose
Enable detailed logging of job creation, progress, and completion

.EXAMPLE
./orchestrate-parallel-tasks.ps1 -Phase 1

./orchestrate-parallel-tasks.ps1 -Phase 3 -Verbose

./orchestrate-parallel-tasks.ps1 -GroupName Phase3_Tests -ContinueOnError

./orchestrate-parallel-tasks.ps1 -Phase all

.NOTES
Requires task-parallel-groups.json in same directory.
Job output is captured and displayed per group.
#>

param(
    [Parameter(Position=0)]
    [ValidateSet('all', '1', '2', '3', '4', '5', '6', '7')]
    [string]$Phase = 'all',
    
    [Parameter()]
    [string]$GroupName,
    
    [Parameter()]
    [switch]$ContinueOnError,
    
    [Parameter()]
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Import common helpers
. (Join-Path $ScriptDir 'common.ps1')

# Load configuration
$configPath = Join-Path $ScriptDir 'task-parallel-groups.json'
if (-not (Test-Path $configPath)) {
    Write-Error "Configuration file not found: $configPath"
    exit 1
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json

Write-Host "🚀 Task Orchestrator: Advanced Dashboard (Spec 018)" -ForegroundColor Cyan
Write-Host "Config: $configPath" -ForegroundColor Gray
Write-Host "Phase: $Phase | ContinueOnError: $ContinueOnError" -ForegroundColor Gray
Write-Host ""

# Filter groups by phase
$groups = @()
if ($Phase -eq 'all') {
    $groups = $config.taskGroups
} else {
    $groups = $config.taskGroups | Where-Object { $_.phase -eq [int]$Phase }
}

# Filter by group name if specified
if ($GroupName) {
    $groups = $groups | Where-Object { $_.name -eq $GroupName }
    if (-not $groups) {
        Write-Error "Group not found: $GroupName"
        exit 1
    }
}

if ($groups.Count -eq 0) {
    Write-Error "No groups found for phase: $Phase"
    exit 1
}

# Execute groups sequentially
$groupIndex = 0
$failedTasks = @()

foreach ($group in $groups) {
    $groupIndex++
    Write-Host "[$groupIndex/$($groups.Count)] Group: $($group.name)" -ForegroundColor Cyan
    Write-Host "  Description: $($group.description)" -ForegroundColor Gray
    Write-Host "  Tasks: $($group.tasks -join ', ')" -ForegroundColor Gray
    Write-Host "  Mode: $($group.parallel ? 'Parallel' : 'Sequential')" -ForegroundColor Gray
    
    # Create job for each task
    $jobs = @()
    
    if ($group.parallel) {
        # Start all tasks as jobs simultaneously
        Write-Host "  🔄 Starting $($group.tasks.Count) parallel jobs..." -ForegroundColor Cyan
        
        foreach ($task in $group.tasks) {
            $job = Start-Job -ScriptBlock {
                param($task, $verbose)
                
                # Simulate task execution (replace with actual task logic)
                Write-Host "  ▶ Task: $task" -ForegroundColor Yellow
                
                # Placeholder: actual task would be:
                # - Running tests: dotnet test ...
                # - Running linters: npm run lint
                # - Running builds: dotnet build / npm run build
                # - Creating files: implementation files
                
                Start-Sleep -Milliseconds (Get-Random -Minimum 500 -Maximum 2000)
                
                Write-Host "  ✓ Task: $task (completed)" -ForegroundColor Green
                return @{ task = $task; status = 'success'; exitCode = 0 }
                
            } -ArgumentList $task, $Verbose
            
            $jobs += $job
            if ($Verbose) {
                Write-Host "    Job created: $($job.Id) for task '$task'" -ForegroundColor Gray
            }
        }
        
        # Wait for all jobs to complete
        Write-Host "  ⏳ Waiting for $($jobs.Count) jobs to complete..." -ForegroundColor Yellow
        $jobResults = $jobs | Wait-Job | Receive-Job
        
        foreach ($result in $jobResults) {
            if ($result.status -ne 'success') {
                $failedTasks += $result.task
                Write-Host "  ✗ Task: $($result.task) (failed)" -ForegroundColor Red
                
                if (-not $ContinueOnError) {
                    Write-Error "Task failed: $($result.task). Aborting."
                    exit 1
                }
            } else {
                Write-Host "  ✓ Task: $($result.task) (success)" -ForegroundColor Green
            }
        }
        
        $jobs | Remove-Job
        
    } else {
        # Execute sequentially
        Write-Host "  🔄 Starting $($group.tasks.Count) sequential tasks..." -ForegroundColor Cyan
        
        foreach ($task in $group.tasks) {
            Write-Host "  ▶ Task: $task" -ForegroundColor Yellow
            
            # Placeholder: actual task logic
            Start-Sleep -Milliseconds (Get-Random -Minimum 500 -Maximum 1500)
            
            Write-Host "  ✓ Task: $task (completed)" -ForegroundColor Green
        }
    }
    
    Write-Host ""
}

# Summary
Write-Host "═" * 60 -ForegroundColor Cyan
Write-Host "✓ Orchestration Complete" -ForegroundColor Green
Write-Host "Groups executed: $groupIndex" -ForegroundColor Cyan
Write-Host "Failed tasks: $($failedTasks.Count)" -ForegroundColor $(if ($failedTasks.Count -gt 0) { 'Red' } else { 'Green' })

if ($failedTasks.Count -gt 0) {
    Write-Host "Failed tasks:" -ForegroundColor Red
    $failedTasks | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

Write-Host "Status: SUCCESS" -ForegroundColor Green
exit 0

# Delivery And Git Workflow

## Scope
Branching, PR, CI, and feature-flag governance.

## Required
- Follow trunk-based development with short-lived feature branches.
- Open PRs for all changes; do not push directly to main.
- Link each PR to a GitHub issue.
- Keep branches current with main before merge.
- Use feature flags for in-progress work merged to main.
- Limit active feature flags and remove them after rollout.
- Preserve owner-controlled final merge authority.

## CI Expectations
- Validation checks must pass before merge.
- Include build, formatting/linting, unit/integration checks, and E2E.

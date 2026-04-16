# Research: Ride Notes

**Feature**: 014-ride-notes
**Date**: 2026-04-14
**Status**: Complete

## Decision 1: Note storage model

**Decision**: Store ride notes as optional plain text with a hard maximum of 500 characters.

**Rationale**:
- Matches explicit clarifications and FR-005.
- Supports rides without notes (FR-004).
- Fits current `RideEntity` scalar-field pattern.

**Alternatives considered**:
- Separate notes table: rejected as unnecessary complexity for a single optional ride attribute.
- Unlimited-length note text: rejected due to UX and data quality constraints.

## Decision 2: Security and rendering behavior

**Decision**: Treat notes as plain text only and always render with escaped output (no raw HTML rendering).

**Rationale**:
- Prevents script injection in history overlays and import previews.
- Preserves punctuation and line breaks without introducing HTML sanitization dependencies.
- Aligns with clarification to store plain text and encode on display.

**Alternatives considered**:
- Allow HTML or Markdown: rejected due to XSS risk and out-of-scope formatting behavior.
- Strip subsets of tags: rejected due to ambiguous edge cases and inconsistent UX.

## Decision 3: History UX pattern for dense rows

**Decision**: Use a compact per-row note indicator icon shown only when a note exists, with reveal via hover/focus and equivalent tap behavior.

**Rationale**:
- Preserves row density and avoids grid reflow.
- Satisfies keyboard and touch accessibility requirements.
- Reuses existing lightweight icon affordance pattern in the history UI.

**Alternatives considered**:
- Full inline note column text: rejected because it expands row height and harms scanability.
- Click-only modal without hover/focus support: rejected because desktop discoverability and keyboard usability degrade.

## Decision 4: Import validation for oversized notes

**Decision**: If imported note length exceeds 500 characters, mark only that row invalid and continue importing other valid rows.

**Rationale**:
- Matches FR-016 and accepted clarification.
- Preserves resilient import behavior for mixed-quality CSVs.
- Keeps import failure localized and actionable.

**Alternatives considered**:
- Auto-truncate notes: rejected because it silently mutates user data.
- Fail entire import: rejected because one bad row should not block all valid rows.

## Decision 5: Test strategy

**Decision**: Add note coverage at backend unit/service level, frontend component/unit level, and E2E happy/security paths.

**Rationale**:
- Honors constitution TDD gate and multi-layer validation requirements.
- Ensures parity across manual entry, history display, and import.
- Catches regressions in both contracts and UI behavior.

**Alternatives considered**:
- Backend-only tests: rejected because hover/focus/tap UI behavior would be unverified.
- Frontend-only tests: rejected because contract and import validation rules require backend assertions.

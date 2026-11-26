# Phase 7 stabilization report — IN PROGRESS

Phase 7 is not complete or production-approved. This report records the current checkpoint; the roadmap contains detailed implementation decisions and verification history.

## Verified changes
- Isolated PostgreSQL integration contexts and feature-branch CI.
- Catalog search no longer replaces global library data; duplicate category dropdown/ID removed.
- Shared renewal eligibility rejects overdue loans while preserving dates/fines; injected Clock supports deterministic tests.
- Unicode-safe notifications, PostgreSQL conflict handling, transactional persistence and after-commit optional email.
- Immediate JWT revocation, stable optional member/account FK, atomic member-account email changes and persistent notification ownership.

## Verification
Latest full backend verify: 78 tests passed. Subsequent focused identity suite: 3 passed. These are separate runs, not a claim that all current tests ran together.
Frontend last verified: 27 tests, typecheck and production build passed.
Public Chromium checks on 2026-11-26: search narrows results while sidebar/dashboard counts remain complete; one category dropdown, unique IDs, no horizontal overflow at desktop and 390px mobile. Mobile screenshot inspected.

## Database and security
New migrations V7–V9 add token/row versions, member account links and notification member identity. Previous migrations unchanged. New migrations tested in disposable containers only. Read-only development preflight found zero normalized email conflict groups. No database reset, deployment, push or merge performed.
Old tokens require reauthentication. Staff-account email changes through member management are rejected. Optional SMTP remains best-effort with logged failures and durable in-app notifications.

## Remaining acceptance work
Staff borrow/scanner browser checks; overdue HTTP checks; realistic hold notification and migration conflict/backfill fixtures; activation synchronization and identity race review; FIFO inventory allocation and concurrency limits; timer/WebP/health/gauge improvements; final complete backend/frontend/infrastructure/runtime verification.

## Files, learning and manual checks
See IMPLEMENTATION_ROADMAP.md for files, test evidence and beginner-friendly explanations by step. Final file inventory, API changes, manual test procedures, residual risks and commit checklist will be completed after acceptance verification.

## Git and next step
All stabilization changes remain uncommitted on feature/production-stabilization. Preserve them. Suggested final commit message, once verified: `fix: stabilize library circulation, identity and catalog state`.
Resume the first pending verification in the roadmap; do not start Phase 8.

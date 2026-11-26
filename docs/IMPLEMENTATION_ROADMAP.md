# Phase 7 stabilization roadmap

Scope: Phase 7 only. Preserve UI, data, existing migrations, and business functionality. Stop after verified Phase 7 for review; phases 8–11 are deferred.

## Baseline (2026-11-25)
- Clean initial worktree at 2705b57; created feature/production-stabilization from feature/catalog-ui-redesign.
- Maven declares Spring Boot 4.2.0 and Java 21. README version references are stale.
- PostgreSQL 17; migrations V1–V6. React 19, TypeScript, Vite; no lint script configured.
- Backend controller/service/repository architecture; BCrypt login and stateless JWT RBAC. JWT currently validates signature/issuer without current account state.
- SecurityIntegrationTest and context test inherit development datasource: full baseline suite intentionally deferred until isolation is fixed to protect user data.
- Safe backend unit/controller baseline: 49 tests passed, zero failures/errors/skips.
- Frontend baseline: 26 tests passed; typecheck and build passed. Main JS 469.02 kB (128.63 kB gzip), scanner chunk 459.11 kB; CSS 92.59 kB.
- Compose configuration validation passed; existing API, frontend, and healthy database observed running. No services modified.
- Reviewed README, POM, package scripts, CI, configuration, security configuration, migrations and integration-test setup.

## Progress checklist
- [x] Initial Git/configuration/test baseline inspection
- [ ] Complete detailed service/frontend audit while verifying each reported defect
- [x] 7.1 Shared isolated PostgreSQL tests and CI
- [ ] 7.2 Catalog/global state and lookup regressions
- [ ] 7.3 Overdue renewal rules and deterministic date tests
- [ ] 7.4 Unicode-safe, concurrent, reliable notifications
- [ ] 7.5 Stable member identity and immediate JWT revocation
- [ ] 7.6 FIFO inventory allocation, limits, locking and PostgreSQL concurrency tests
- [ ] 7.7 Timer isolation, WebP, health polling removal, copy-level gauge
- [ ] Full backend verify, frontend checks, infrastructure and runtime/UI checks
- [ ] Phase 7 stabilization report with learning notes and manual tests

## 7.1 implementation and verification
- Added `PostgresIntegrationTest` base with a Spring-managed `postgres:17-alpine` bean and `@ServiceConnection`. All three full-context tests inherit it.
- Container lifecycle follows the cached Spring context, avoiding a stopped JUnit container with a still-live datasource. Explicit test properties prevent `.env` import, local bootstrap, email and automatic scheduled execution. Manually invoked job tests remain enabled.
- CI now validates feature branch pushes as well as main pushes and pull requests targeting main.
- Executed `cd backend && ./mvnw -B verify`: **62 passed, zero failures/errors/skips**, BUILD SUCCESS (26.608 seconds). All three contexts started disposable PostgreSQL databases on dynamic ports; Flyway validated/applied V1–V6 successfully. No applied migration changed.
- Non-blocking Maven metadata warnings: optional Flyway GitHub/Azure repositories returned HTTP 401; dependency resolution and verification succeeded.
- Learning: `@ServiceConnection` supplies actual container connection details ahead of normal datasource properties; `@TestConfiguration` limits this bean to tests. Docker is required, but development database credentials are not.

Next: finish 7.2 browser verification, then 7.3 renewal rules. Inspection also confirms 7.3 defect: `performRenewal` checks fines and holds but not overdue dates, and `Loan.renew` moves an overdue due date forward. Address with shared rules and deterministic date coverage.

## 7.2 implementation (browser verification pending)
- Verified duplicate category select/ID in BooksPage and search-dependent shared `books` state in App.
- Removed the duplicate control. Kept the full library snapshot in App; existing BooksPage filtering derives a separate visible subset without changing shared data. Removed redundant debounced API search (the existing API returns the full library and pagination remains client-side in Phase 7).
- Borrow/scanner still receive all books regardless of catalog filters. Existing copy lookup APIs remain in use; no additional lookup endpoint is necessary for this complete-library architecture. Server pagination is deferred to Phase 8 as requested.
- Added App-level rendered regression coverage for filtered results, unchanged sidebar/dashboard counts, complete book props delivered to borrow/scanner, no search-triggered fetch, one category select, and unique IDs. Child circulation UIs are mocked in this state-wiring test; real browser workflow verification remains outstanding.
- Executed frontend unit tests: 27 passed; typecheck/build passed. Main JS 468.25 kB (128.49 kB gzip); unchanged CSS and scanner chunk. `git diff --check` passed.
- Applied UI/UX accessibility and React hooks review guidance; existing styling and artwork unchanged.

## 7.3 renewal protection implemented
- Verified overdue renewal bypass: previous code reset an overdue due date to today + 14, erasing the basis for accrued fines.
- Loan now owns a shared eligibility reason used by LoanService and LoanResponse. Returned, overdue, inactive, fine-blocked, renewal-limit and active-hold rules drive both mutation and UI eligibility. Entity renewal independently guards intrinsic rules.
- Added injectable `Clock` bean; LoanService uses it for dates, instants and response calculations. Existing default zone is preserved. DTO supports an explicit reference date for deterministic tests.
- Parameterized tests cover both staff/member service entrypoints before/on/after due date, unchanged overdue due date/history/fine accrual, and fine-blocked members on both paths. Existing tests cover ownership rejection, hold conflict and renewal limit.
- Full `./mvnw -B verify`: 70 passed, zero failures/errors/skips, BUILD SUCCESS (27.484s). No migration needed.
- Remaining verification: add HTTP/PostgreSQL overdue rejection coverage and inactive DTO regression while completing the overall Phase 7 security/concurrency tests. Browser verification from 7.2 remains pending.
- Learning: injecting Clock makes time an explicit dependency, allowing fixed-date boundary tests without changing the machine clock. A shared domain rule prevents UI eligibility from diverging from server enforcement.

## 7.4 notification reliability implementation
- Confirmed titles were unbounded and duplicate detection used a race-prone existence check despite the V6 unique index.
- Reused the existing partial unique index with atomic PostgreSQL `INSERT ... ON CONFLICT DO NOTHING`. Duplicate reminders return false without aborting circulation transactions. No migration or data deletion required.
- Centralized Unicode code-point truncation to 160 title / 500 message characters, including an ellipsis. Supplementary-plane characters remain intact.
- Notifications participate in the circulation transaction: rollback removes both changes. Unexpected database failures remain visible and roll back atomically rather than silently losing an in-app notification. Optional SMTP runs after commit; failures are logged and cannot roll back completed circulation.
- PostgreSQL integration tests: eight simultaneous duplicate attempts produce one row; long emoji title/message fit schema; rollback removes notification and allows later successful retry.
- Full Maven verify passed 72 tests (27.198s). A subsequently added after-commit/SMTP-failure unit test passed with the focused NotificationAndSchedulerTest suite (4 tests). Final full suite will include 73 tests before further additions.
- Existing reminder-job unit and API integration tests passed. `git diff --check` passed.
- Limitation: optional SMTP remains best-effort without durable retry across process crashes; durable in-app notification remains available. A mail outbox would be required for guaranteed email delivery and should be considered if that becomes a product requirement.
- Next: stable account/member identity, token revocation, and outstanding HTTP/browser verification; 7.4 final audit also needs realistic maximum-length hold-title transaction coverage.

## 7.5 JWT revocation implemented; identity synchronization still pending
- Added V7 migration with token version and optimistic row version; existing records retained and V1–V6 unchanged. Applied only in disposable test databases.
- AppUser password, enabled-status and role mutations rotate token version. Re-enabling an account does not reactivate old tokens. JPA optimistic locking prevents concurrent account edits silently overwriting one another.
- JwtService requires a real enabled account and signs its current role/version. Decoder validates current enabled state, role and token version in addition to signature/issuer/expiry. Old pre-migration tokens without version require reauthentication.
- HTTP/PostgreSQL tests prove revoked tokens receive 401 after disable/re-enable, demotion, password reset and own-password change; newly issued tokens work with current permissions (member staff access returns 403).
- Updated API test fixtures to create real accounts. Existing lifecycle test expected 403 from a now-revoked token; corrected to 401 after observing the failure.
- Full Maven verify: 76 passed, zero failures/errors/skips, BUILD SUCCESS (27.033s); Flyway validates/applies V1–V7. `git diff --check` passed before final test run.
- Remaining: stable member/account FK, atomic email/activation synchronization and notification recipient preservation; review concurrent login/password-change boundary and frontend handling of password-change logout; complete phase-wide verification.

## 7.5 stable identity foundation
- Read-only development DB preflight counted zero duplicate normalized account/member email groups. No development schema/data changes performed.
- Added V8: fail before changes on ambiguous normalized emails, enforce normalized email uniqueness, add nullable unique Member-to-AppUser FK, and backfill exact normalized matches. Offline members remain supported; no records merged/deleted.
- Member profile resolution locks the account and looks up its stable FK before considering email. Concurrent first-time requests serialize and reuse one profile; existing offline member ID/name are preserved when linked.
- Member account association is excluded from JSON to avoid exposing credentials through entity serialization.
- Full Maven verify passed 76 tests (28.137s), including V1–V8 migration validation/application in isolated containers. Subsequently added focused identity integration suite: 2 passed (14.212s), proving four concurrent requests reuse one ID and existing offline profile is linked in place.
- Still incomplete: atomic account/member email synchronization, notification access preservation after email changes, bidirectional activation rules, migration conflict/backfill fixtures, and identity lookup/ownership audit. These are the next required work; 7.5 is not marked complete.

## 7.5 email and notification identity synchronization
- Added V9 notification recipient-member FK/backfill and member-scoped idempotency index. Lookup/read/unread operations resolve current member identity while preserving stored original delivery email; unlinked recipients retain email lookup.
- Member email updates now change linked MEMBER account email and revoke its tokens in the same transaction. Account/member uniqueness conflicts are rejected. Staff account email edits through member endpoints are blocked to prevent librarian-to-admin identity takeover.
- Linked members cannot be deleted through member APIs; deactivation preserves identity/history. Updated the lifecycle integration expectation to a domain conflict.
- Full Maven verify passed 78 tests (28.011s), V1–V9 applied in isolated databases. Subsequent focused identity suite passed 3 tests (15.157s), including email change, token-version rotation, same member ID, old-notification access/read state, denied old-email access and conflict rollback. `git diff --check` passed.
- Remaining: activation synchronization, concurrent email-update/notification-creation and login/password-change race audit, migration backfill/conflict fixtures, full HTTP identity/serialization checks. 7.5 remains incomplete.

## Resume audit — 2026-11-26
- Inspected Git status and Surefire reports; all prior implementation changes remain present. No completed phase report existed. Added a clearly marked in-progress Phase 7 report for review/resumption.
- Completed: 7.1 isolated tests/CI. Partial: 7.2 catalog (staff browser verification remains), 7.3 renewal (HTTP cases remain), 7.4 notifications (migration/real hold coverage remains), 7.5 identity/security (activation and concurrency follow-ups remain). Pending: 7.6 circulation locking/queue/inventory and 7.7 frontend performance, then full acceptance audit/report.
- First outstanding verification resumed: ran current frontend via Vite on 5173 and inspected real Chromium using Playwright CLI. Public backend catalog returned two titles. Filtering to “Spring in Action” showed one result, sidebar remained 2; navigating Overview retained Total Catalog Books 2 and both recent titles.
- Browser DOM check: one category dropdown, no duplicate IDs, no desktop horizontal overflow. At 390×844, document width remained 390; screenshot visually inspected with existing illustration, typography and toolbar intact. Artifact: output/playwright/catalog-mobile.png.
- Browser console had no errors; existing unused hero preload warning is tracked under 7.7.
- Running local frontend handle: exec session 89185; Playwright browser session phase7. Revalidate handles before reuse. No data writes performed during browser checks.
- Next: staff borrow/scanner browser regression, then finish earlier pending HTTP/migration checks and activation synchronization. Continue Phase 7 only.

# Phase 7.1 final verification — IN PROGRESS

Date: 2026-11-26. Scope: stabilization only, no Phase 8 or public deployment.

## Resume checklist
- [x] Inspect roadmap, report, Git checkpoint, service rules, tests and migrations.
- [x] Implement database-backed checkout eligibility locking and related lock ordering.
- [x] Add PostgreSQL contention, hold allocation and rollback tests.
- [x] Verify fresh migrations and populated V6 upgrade fixtures with immutable V1–V9.
- [x] Add isolated staging Compose and production profile; harden reverse proxy and CI.
- [x] Frontend: 29 tests, typecheck and production build passed.
- [ ] Final backend verification after all edits.
- [ ] Production-profile isolated runtime, browser, restart and restore checks.
- [ ] Final acceptance matrix, Git inventory and GO/NO-GO decision.

## Executive summary and checkpoint correction
The initial worktree was clean at `4d04df4` on `feature/production-stabilization`; the earlier Phase 7 changes were already committed. V7–V9 are tracked in that commit. The older reports' uncommitted statement was stale. No prior implementation was discarded. The initial full verification reproduced 79 backend tests; subsequent additions increase that count. No development database was reset, migrated, or written by this task.

## Verified problems and fixes
- Different-book checkouts locked different Book rows and could both observe four active loans for the same member. Checkout now acquires a pessimistic member write lock before active-status, count and fine checks, and retains it through transaction commit/rollback.
- Return/renew/cancel locked child records before Book, reversing the inventory lock order. Scalar book-ID lookups now precede Book locking and loading mutable child state.
- Hold expiration loaded Hold entities before waiting on Book, permitting stale state in a second worker's persistence context. It now selects ordered scalar book IDs, locks each Book, and rereads eligible holds after the lock.
- Unrelated global expiration before single-title operations unnecessarily held multiple books. Those operations expire only their own title. Global expiry locks titles in ascending order. Identity provisioning occurs before Book acquisition.
- Copy locks could address another title before validating ownership. New constrained copy lookup locks only a copy belonging to the already locked Book.
- Book edits could flush stale availability over a concurrent checkout. Mutating book edit/delete operations now take the inventory Book lock.
- Member deactivation's zero-active-loan check and deletion eligibility now acquire the same Member lock as checkout.
- No production profile or isolated deployment definition existed. Added production settings, separate private-database Compose stack, health-dependent startup, proxy security/cache settings, and pull-request Compose validation.

## Checkout concurrency design
Order: identity/account provisioning (when needed), then Book, then Member (checkout), then Loan/Hold, then Copy. Operations that do not need a tier skip it; never introduce a reverse acquisition. Global expiration takes Book IDs in ascending order. Book is the inventory aggregate lock shared by checkout, return, renewal, copy mutation and hold allocation. Fulfillment relies on that lock before calling the transactional checkout service and does not take a Hold lock before Member.

`borrow` declares `@Transactional(isolation = READ_COMMITTED)`; production Hikari also uses READ_COMMITTED. PostgreSQL evaluates the count statement after the member lock is acquired, so the waiting request sees the preceding committed loan. A limit failure remains a business conflict with `Borrowing limit reached (5/5 active loans)`. Rejection rolls back all writes. Protection is in PostgreSQL, so it applies across backend instances; no JVM lock was added. Existing per-copy active-loan/ready-hold unique indexes remain defense in depth. Supported service boundaries use READ_COMMITTED; callers must not wrap these methods in a long-lived stronger-isolation snapshot.

The deterministic limit test holds the Member row in a third transaction, launches two independent checkouts, observes both blocked in `pg_stat_activity`, then releases the lock. It checks one success, one limit rejection, final count five, one unchanged available copy, and consistent title availability. Additional tests cover two borrowers/one copy, two expiry workers/one released copy, double return/FIFO promotion, and rollback after checkout followed by successful retry. Barrier-based workers confirm READ_COMMITTED on separate connections and use bounded futures; no timing-only sleep race.

## Migration verification
`FlywayMigrationIntegrationTest` creates disposable PostgreSQL 17 containers/schemas only. It verifies fresh V1–V9 installation, checksum validation and no-op repeated migration. A populated V6 fixture upgrades through V7–V9 while preserving member IDs, an offline member, account link, notification text/read state and unmatched recipient, returned loan history and paid fine amount. Invalid foreign keys, duplicate account linkage and normalized member email uniqueness are rejected. Ambiguous normalized V6 member identities fail V8 transactionally without removing either record.

No applied migration was edited; no correction migration was necessary for these fixtures. These fixtures are representative, not a claim about every production dataset. Run the documented normalized-email and notification-dedupe preflight on a sanitized copy of the actual release database. See [staging and recovery runbook](STAGING_RUNBOOK.md).

## Acceptance coverage and limits
Automated backend coverage includes staff/member login, bad credentials, role authorization, account lifecycle, JWT disable/re-enable/role/password revocation, member profile lifecycle, book creation/search/categories, checkout/return, holds and fulfillment, expiry, renewal limits/ownership/overdue boundaries, fine calculation/payment/waiver, notifications/idempotency/rollback, and multi-copy inventory. The HTTP regression additionally confirms an overdue desk renewal returns conflict without moving the due date.

Frontend unit tests include catalog/global-state separation, barcode parsing/matching, book metadata forms, bookshelf, notification UI, selected physical copy submission and borrowing-limit error display. Unit scanner parsing is not physical-camera acceptance. Real browser/runtime results will be recorded below after execution.

## Configuration and operating limits
Production disables Swagger/OpenAPI, SQL debug logging and Flyway clean, keeps schema validation, provides database-aware readiness and graceful shutdown, and requires environment-provided database credentials/JWT key. Staging publishes only loopback frontend; PostgreSQL/API have no host mappings. No wildcard CORS: same-origin SPA/API is the supported deployment. TLS terminates at a trusted edge; forwarded headers are normalized by nginx, and edge TLS/HSTS/certificate renewal still require external setup. Static fingerprinted assets cache for one year; HTML revalidates. CI verifies all pull requests, uses read-only repository permissions, and validates both Compose files.

There is no repository lint script/configuration to execute; do not interpret typecheck as lint. Optional SMTP remains best-effort after commit, with durable in-app notifications but no durable email retry/outbox. No UI redesign, new application dependency, push, merge, public deployment, or branch deletion was performed.

## Spring Boot concepts learned
- `@Transactional` keeps eligibility reads and loan/inventory changes in one commit; unchecked business failures roll back the unit of work.
- `PESSIMISTIC_WRITE` is a database row lock, shared by all application instances. An in-memory lock cannot provide that guarantee.
- Isolation and locking solve different problems: READ_COMMITTED permits a fresh count after waiting; the member lock serializes competing eligibility decisions.
- Consistent aggregate-first lock order avoids child/parent deadlock cycles. Scalar projections avoid caching mutable entities before a lock wait.
- JPA dirty checking can overwrite stale columns; shared mutation locks protect inventory updates.
- Testcontainers verifies actual PostgreSQL semantics, while mocked tests only verify local behavior.
- Flyway validation checks immutable migration history; fresh installation and upgrade fixtures exercise different risks.
- Profiles separate runtime policy from code; Actuator readiness and Compose health dependencies make startup sequencing observable.

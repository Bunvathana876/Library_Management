# Phase 7.1 final verification — local staging verified; production NO-GO

Date: 2026-11-26. Scope: stabilization only, no Phase 8 or public deployment.

## Resume checklist
- [x] Inspect roadmap, report, Git checkpoint, service rules, tests and migrations.
- [x] Implement database-backed checkout eligibility locking and related lock ordering.
- [x] Add PostgreSQL contention, hold allocation and rollback tests.
- [x] Verify fresh migrations and populated V6 upgrade fixtures with immutable V1–V9.
- [x] Add isolated staging Compose and production profile; harden reverse proxy and CI.
- [x] Frontend: 29 tests, typecheck and production build passed.
- [x] Final backend verification: 87 tests, zero failures/errors/skips; Maven verify/build passed.
- [x] Production-profile isolated runtime, browser keyboard-scanner path, restart and restore checks. Physical-camera and external TLS acceptance remain manual.
- [x] Final acceptance matrix, Git inventory and NO-GO decision recorded below.

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

## Final executed evidence

| Check | Result |
| --- | --- |
| `cd backend && ./mvnw -B verify` | **87 passed**, zero failures/errors/skips; packaged Boot JAR successfully. Confirmed by Surefire XML totals. |
| PostgreSQL concurrency suite (included above) | **5 passed**: member limit, same copy, parallel expiration, parallel return/promotion, rollback/retry. |
| Flyway fixture suite (included above) | **3 passed**: fresh/restart, populated V6 upgrade, ambiguous identity rejection. |
| `cd frontend && npm test` | **29 passed** across 11 files. |
| `npm run typecheck`; `npm run build` | Both passed; no application dependency added. |
| Lint | No existing lint command/configuration; not claimed as passed. |
| `docker compose -f compose.yaml config --quiet` | Passed without starting/changing development services. |
| Isolated staging Compose validation and `up -d --build --wait` | Passed; all three services healthy. Initial registry timeout retried successfully. Runtime already contains curl; unnecessary apt install removed. |
| `python3 scripts/staging_smoke.py /tmp/library-phase71-staging.env` | Passed proxied production-profile health, registration/login, staff/member RBAC, book create/edit/filter, checkout/return, renewal/overdue conflict, payment/waiver and copy totals. |
| Production internals | `/actuator/health/readiness` UP; `/v3/api-docs` 404. |
| Proxy behavior | nosniff present; fingerprinted JS cache max-age 31536000. |
| Browser | Real Chromium staff login; borrow modal selected CPY-0001-02 for member 2, produced loan 3; scanner keyboard entry LOAN-0003 resolved and Confirm Return succeeded. |
| Responsive smoke | Dashboard document width fits 390, 768 and 1440px; 390px screenshot visually inspected. No claim that every dialog/page was exhaustively tested at each size. |
| Restart and backup restore | `pg_dump -Fc` restored successfully into a NEW isolated database; counts matched: 2 members, 3 loans, 2 notifications, 9 migrations. Full stack restart preserved the same records; health returned UP. This is a local restore drill, not off-site disaster recovery certification. |
| Git hygiene | `git diff --check` passed; `.env`, screenshots/output, logs and generated artifacts excluded. V1–V9 byte-for-byte unchanged from the earlier committed checkpoint. |

Local logs: `/tmp/library-phase71-backend-final.log`, `/tmp/library-phase71-staging-release.log`. Browser artifact: `output/playwright/phase71-mobile.png` (ignored). Secrets and temporary browser fixture credentials are outside Git with mode 0600. The verification stack remains running at `http://127.0.0.1:3100` with isolated `library-phase71_staging_pg_data`; development services/data were not modified. The restored fixture database and local dump are retained in isolated infrastructure.

## Remaining acceptance gates and blockers

1. **Physical camera/device acceptance:** on a real HTTPS/localhost browser, grant camera access, scan a copy barcode and member QR, complete checkout, scan loan/copy return, then test denied permission, no camera, camera switching and modal-close stream cleanup. Repeat on supported mobile Safari/Chrome and an actual USB scanner. Only keyboard scanner resolution/return and the camera-start/pause UI were exercised here; optical decoding is NOT passed.
2. **External staging/production environment:** no approved public host, domain, TLS certificate, production secret store, administrator provisioning, SMTP provider or monitoring/alerting destination was supplied. Configure these using the runbook, verify HTTPS/forwarded-header behavior and off-host backups, then obtain deployment approval. No public deployment occurred.
3. **Actual-data migration preflight:** representative fixtures passed, but a sanitized copy of the eventual production dataset was unavailable. Check normalized identities and notification dedupe conflicts before release. Never repair checksums or automatically delete ambiguous records.
4. **Existing Phase 7 identity follow-ups:** member circulation activation and AppUser login-enabled status remain distinct; bidirectional synchronization and the concurrent login/password-change/identity-notification edge-case audit are not completed by this change. Existing revocation tests cover already-issued tokens. These must not be represented as a completed identity/security audit.
5. **Existing presentation/performance follow-ups:** the availability dashboard remains title-based (a title with one of two copies available displays as available); copy-level gauge work, timer isolation, hero WebP/preload and health-polling improvements from roadmap 7.7 remain open. This task preserved the UI. The observed unused preload warning is not an application crash.
6. **Email reliability:** persisted in-app notifications are transactional and tested; optional SMTP is best-effort with no durable retry. Agree on the required email SLA and validate delivery in the target environment.

**Decision: NO-GO for production.** The checkout race is fixed, migrations and automated regressions pass, and local isolated staging is operational. The external deployment, physical-device, actual-data and outstanding identity/security gates above prevent production approval. This is not a claim that all of Phase 7 is finished; Phase 8 has not started.

## Git checkpoint and suggested staging
On continuation, HEAD was `6907065` (`feat: harden circulation locking, Flyway verification, and staging/production deployment`) and the worktree was clean. That commit already contains the implementation, tests, staging runbook and smoke script developed earlier in this task. Prior V7–V9 remain in its ancestry via `4d04df4`. No commit/push/merge was performed by this continuation.

At the Phase 7.1 checkpoint, these documentation changes needed staging:

```sh
git add docs/IMPLEMENTATION_ROADMAP.md docs/PHASE_7_STABILIZATION_REPORT.md docs/PHASE_7_FINAL_VERIFICATION_REPORT.md
```

Suggested commit: `docs: record Phase 7.1 verification and production release gates`

Suggested combined release description: `fix: serialize circulation and verify isolated staging readiness`

Resume at the first unchecked release gate above; retain all existing commits and data. Run the relevant checks again if implementation changes while closing those gates.

## Responsive follow-up — 2026-11-27
The subsequent responsive UI work is documented in [RESPONSIVE_UI_VERIFICATION.md](RESPONSIVE_UI_VERIFICATION.md). The worktree now also includes CSS repairs and that new report; use its Git handoff list for the current staging inventory. Frontend tests remain 29 passing; the original design and backend rules are preserved. The production NO-GO gates above remain unchanged.

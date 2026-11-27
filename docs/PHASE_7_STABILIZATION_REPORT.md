# Phase 7 stabilization report — local staging verified, production NO-GO

Updated 2026-11-26. The detailed evidence, remaining gates and learning notes are in [PHASE_7_FINAL_VERIFICATION_REPORT.md](PHASE_7_FINAL_VERIFICATION_REPORT.md); deployment and recovery steps are in [STAGING_RUNBOOK.md](STAGING_RUNBOOK.md).

## Current verified checkpoint
- HEAD on continuation: `6907065`; prior Phase 7 work is committed, not uncommitted as the older report stated.
- Backend Maven verify/build: **87 tests passed**, zero failures/errors/skips, including five PostgreSQL concurrency tests and three Flyway fixture tests.
- Frontend: **29 tests passed**, typecheck and production build passed. No lint script exists.
- Both Compose definitions validate. Isolated production-profile PostgreSQL/API/frontend start healthy; API authentication, RBAC, proxy communication and circulation smoke pass.
- Real browser staff login and selected-copy borrowing pass; keyboard scanner resolves and returns the resulting loan. Dashboard fits 390/768/1440px; mobile screenshot inspected.
- Backup restored into a new isolated database; record counts matched. Full stack restart preserved records and returned healthy.

## Implemented stabilization
Checkout locks Book then Member before checking standing/count, using PostgreSQL READ_COMMITTED. Consistent parent-first locking protects loan/hold/copy operations; expiration rereads holds after acquiring ordered Book locks. Book edit/delete and member status/deletion eligibility participate in relevant locking. Deterministic contention tests observe actual database lock waits.

V7–V9 remain immutable and tracked. Fresh install, populated V6 upgrade, checksums, constraints and preserved identity/notification/loan/fine history pass isolated tests. Production profile, private staging database, health-dependent startup, restricted Swagger, proxy headers/cache rules and PR validation are included.

## Open gates
Physical camera/USB device testing, real domain/TLS/secrets/admin/SMTP/monitoring setup, actual-data migration preflight, outstanding activation/identity/login-race audit, and roadmap 7.7 presentation/performance items remain open. SMTP still lacks durable retry. Do not call all of Phase 7 complete or start Phase 8.

**Production decision: NO-GO.** Local isolated staging is ready for further acceptance. No public deployment, push, merge, branch deletion or development database reset occurred. Only final documentation updates remain uncommitted after the implementation checkpoint. See the final report for the exact staging list and suggested commit message.

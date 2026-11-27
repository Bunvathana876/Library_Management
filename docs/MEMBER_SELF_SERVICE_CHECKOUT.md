# Member account and borrowing flow — verified

Date: 2026-11-27. Existing website and circulation rules preserved.

## Completed checklist
- [x] Inspect existing registration, login, catalog and circulation rules.
- [x] Add authenticated own-account checkout using existing database locking and eligibility rules.
- [x] Add public Create Account and catalog Borrow entry points with explicit confirmation after authentication.
- [x] Add six PostgreSQL HTTP integration tests.
- [x] Add five frontend flow regressions and complete React/accessibility review.
- [x] Run full backend/frontend verification.
- [x] Rebuild isolated staging and verify real browser registration, login, member checkout, mobile and desktop.
- [x] Record final evidence, limits and Git handoff.

## Reader journey
1. Choose **Create Account** in the header, or select **Sign In to Borrow** on an available book.
2. Register with full name, email and a password, or sign in with an existing account. Registration signs the reader in automatically.
3. If a book was selected before authentication, its confirmation opens afterward. Cancelling authentication discards that selection. No loan is created merely by signing in.
4. Review the book and account, then choose **Confirm Borrow**. An eligible copy is assigned for 14 days.
5. **My Bookshelf** shows the loan, copy barcode and actual server-calculated due date. Existing renewal/history/hold features remain available.

Catalog grid, catalog list and book details expose the borrowing action to readers. Staff retain their borrower-selection and physical-copy workflows. Ready holds may be checked out by their owner; other members cannot take the reserved copy. Errors remain visible in the confirmation without reporting false success.

## Backend and security
New `POST /api/me/loans` accepts `{ "bookId": 123 }`. The authenticated JWT subject resolves the stable member identity; caller-supplied memberId cannot select another borrower. The existing `/api/me/**` authentication rule covers this endpoint; the staff `/api/loans` endpoint retains its role restrictions.

Profile resolution commits before `LoanService.borrow` starts its READ_COMMITTED transaction. With open-in-view disabled, checkout reloads current Member state under its write lock. Existing Book → Member → Loan/Hold → Copy locking, five-loan maximum, unpaid-fine restrictions, inactive-member checks, duplicate-title protection and hold ownership all remain enforced. No JVM locking or separate inventory algorithm was introduced. Reservation errors no longer reveal another borrower's name.

The frontend submits only bookId to the own-account endpoint, requires a confirmation click, and prevents repeated pending submissions. Registration/login preserve password-manager autocomplete and paste support. No new dependencies or schema migrations were needed.

## Executed verification

| Check | Result |
| --- | --- |
| `cd backend && ./mvnw -B verify` | **93 passed**, zero failures/errors/skips; Boot JAR packaged. Surefire XML totals confirmed. |
| New `MemberCheckoutIntegrationTest` | **6 passed** against real PostgreSQL Testcontainers: registration/login/checkout/bookshelf and 14-day term; anonymous rejection and attempted borrower impersonation; invalid/duplicate/unavailable requests; fifth-loan limit and rejected-copy preservation; inactive/fine-blocked accounts; reservation ownership. Existing PostgreSQL concurrency tests also pass in full verification. |
| `cd frontend && npm test` | **34 passed** across 12 files. Five new tests cover sign-in continuation, registration continuation, cancellation/direct registration entry, borrowing-limit errors, and repeated confirmation clicks. They use real auth/modal/catalog wiring with mocked APIs; backend behavior is covered separately above. |
| `npm run typecheck`; `npm run build` | Passed. |
| Isolated Compose `up -d --build --wait` | API/frontend rebuilt; database retained. All services healthy. Production profile used locally. |
| Browser registration flow | Created an isolated Website Reader account via the UI. Verified zero loans before confirmation; checkout returned 201 and loan 5 for the authenticated member 5; bookshelf showed the correct title, copy and due date. |
| Browser sign-in flow on built staging | From book details on port 3100, signed in with the created account and retained the selected long-title book. Confirmation created a second loan; both loans persisted after reload. |
| Browser rejection | Attempting a duplicate title from catalog list returned 409 and displayed `Member already has an active loan for this title`; confirmation remained available for cancellation. |
| Responsive checks | 50 combinations: guest catalog, registration dialog, long-title borrow confirmation, populated bookshelf, and list-view borrowing × five viewports × normal/200% root text. Viewports: 320×568, 375×812, 667×375, 768×1024, 1440×900. No horizontal page/dialog overflow; list Borrow clicks and cancellation worked at each size. |
| Visual inspection | Mobile confirmation and mobile/desktop populated bookshelf screenshots reviewed. Existing tokens, layout style and artwork retained. |
| Git whitespace | `git diff --check` passed. |

A real list-view issue was found during browser acceptance: long unbroken metadata enlarged the sticky title column until it intercepted action-button clicks. Catalog table metadata is now bounded and wraps; the same real click passed after the fix across the full size/text matrix. This was not bypassed with forced clicks.

Local logs: `/tmp/library-member-checkout-test.log`, `/tmp/library-member-backend-verify.log`, `/tmp/library-member-staging-build.log`, `/tmp/library-member-staging-final.log`. Ignored screenshots: `output/playwright/member-borrow-confirm-mobile.png`, `member-bookshelf-desktop.png`, `member-bookshelf-mobile.png`. Fixture credentials stay outside Git with mode 0600. Browser console had the known unused hero preload warning; the deliberately rejected duplicate checkout produces an expected HTTP 409 console entry.

## Scope and handoff
Local preview: `http://127.0.0.1:3100` (isolated `library-phase71` stack). Source preview on 5174 proxies this API. The development database was not modified or reset. No public deployment, Git commit or push was performed for this change. All previous changes are preserved.

Physical-device browser/camera acceptance and the broader production gates in `PHASE_7_FINAL_VERIFICATION_REPORT.md` remain separate. This feature's tested flow is complete; it does not change the overall production NO-GO decision or start Phase 8.

Suggested commit: `feat: let readers register, sign in, and borrow their own books`.

Review/stage the member portal controller, new SelfBorrowRequest, LoanService privacy message, MemberCheckoutIntegrationTest, App/auth context/API wiring, catalog/detail/sign-in/header/overview components, new MemberBorrowModal and memberCheckoutFlow tests, catalog wrapping CSS, this report and implementation roadmap. No migration files, generated logs, screenshots or credentials belong in this commit.

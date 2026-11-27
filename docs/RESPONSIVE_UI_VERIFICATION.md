# Responsive UI verification

Date: 2026-11-27. Follow-up to Phase 7.1; no Phase 8 work.

## Screenshot follow-up — 2026-11-27

The supplied public-overview screenshot showed content cut off to the right. A fresh Chrome window at port 3100 correctly switched to mobile navigation, so that exact full-page clipping was not reproduced in the current build. A more detailed check did reproduce **internal hero clipping at 320px with 200% root text**: 301px of content inside a 286px card. A document-width-only check had missed it because the hero hides overflow.

Changes: allow the hero heading/copy to wrap within their available width. Add a named inline-size container on the page content; overview metrics, lower columns and hero now adapt to the actual content width left beside the sidebar and to enlarged text. Existing viewport rules remain as a fallback. Existing colors, illustrations, navigation, member checkout and backend behavior are preserved.

Current completed checklist:
- [x] Reproduce internal clipping and add a reusable browser check that detects it.
- [x] Verify 20 overview combinations on Vite 5174 and repeat all 20 on the rebuilt production frontend at 3100. Widths: 320, 375, 667 (landscape), 689, 768, 1023, 1024, 1100, 1280, 1440; normal and 200% root text. Document width, card content, actual heading text bounds and mobile sidebar state all passed.
- [x] Verify eight catalog width/text combinations, mobile menu open/Escape close, four Create Account dialog widths, and opening Sign In to Borrow with the selected title retained.
- [x] Inspect 689px and 1024px overview screenshots including long catalog titles.
- [x] Frontend unit tests: **34 passed in 12 files**. `npm run typecheck`, `npm run build`, and `git diff --check` passed. No lint script exists. Backend code was not changed or retested in this CSS follow-up.
- [x] Rebuild only the isolated `library-phase71` frontend and recreate it using `up -d --no-deps --wait frontend`; frontend healthy. Database/API containers and data were untouched.

Reusable Playwright CLI callback: `scripts/responsive_overview_audit.js`. With a guest browser session already open to a local populated catalog, pass the file contents to the CLI's `run-code` command. It waits for fonts and finite animations, throws on clipping, and restores text size and viewport afterward. Example from the repository root:

```sh
rtk proxy npx --package @playwright/cli playwright-cli --session responsive-fix open http://127.0.0.1:3100/#overview
rtk proxy npx --package @playwright/cli playwright-cli --session responsive-fix run-code "$(cat scripts/responsive_overview_audit.js)"
```

Evidence in ignored `output/playwright/`: `overview-responsive-staging-audit.txt`, `overview-responsive-689.png`, `overview-responsive-1024.png`. These are Chromium checks; actual device/browser zoom, mobile Safari and physical camera acceptance remain manual. No public deployment, commit or push was performed in this follow-up. Earlier sections below retain the historical audit and its then-current counts.

## Completed checklist
- [x] Preserve existing design, APIs, business rules and uncommitted Phase 7 documentation.
- [x] Repair confirmed narrow-screen and enlarged-text overflow.
- [x] Exercise main pages, forms, record details, scanner, navigation and populated notifications in real Chromium.
- [x] Inspect desktop dark, mobile light, landscape borrowing and enlarged notification screenshots.
- [x] Run frontend unit tests, TypeScript checking, production build and Git whitespace verification.
- [x] Document tested scope and physical-device limits.

## Changes and reasons
`frontend/src/styles/layout.css` permits grid children to shrink, wraps toolbar actions, keeps the closed mobile sidebar hidden from focus, adapts catalog filter columns to available space/text size, and wraps bottom-navigation labels.

`frontend/src/styles/components.css` wraps long titles, categories, member identities and action labels. Dialogs and patron drawers scroll as a whole so long headers cannot consume all space and leave form fields/footer inaccessible. Narrow book details place metadata below the cover/QR row. The scanner manual-entry field shrinks inside its container. Notification panels wrap their header and constrain scrolling to the available viewport, including CSS anchor positioning and its fallback.

Observed defects included 351px overview and 361px loans-page widths in a 320px viewport, very wide unbroken metadata, a scanner dialog with 415px content inside 252px at doubled text, and populated notifications ending below the viewport. These were reproduced before fixing; the final checks below passed. Tables and tab strips intentionally retain their own horizontal scrolling.

## Executed browser checks
Source served by Vite at `http://127.0.0.1:5174`, with API requests proxied to the isolated `library-phase71` stack on port 3100. Generated QA accounts and long-data fixtures belong only to that isolated database. The development database was untouched. No public deployment occurred.

Real Chromium via the Playwright CLI skill; animation completion and two animation frames awaited before measurements. Text enlargement means setting the root font size to 200%, not claiming a physical-device or OS zoom test.

| Coverage | Result |
| --- | --- |
| Overview, Catalog, Loans & Returns, Members, My Bookshelf, Staff & Accounts | 72 combinations: six pages × six viewports × normal/200% root text. All document widths fit. Viewports: 320×568, 375×812, 667×375, 768×1024, 1024×768, 1440×900. |
| Issue loan, add member, add book, scanner, patron history drawer, member QR, edit member, book details, edit book, delete confirmation, reset password, own-password form | 120 combinations: 12 dialogs × five viewports × two text sizes. All dialog bounds fit; no horizontal content overflow. Same viewports except 1024×768. Forms/footers exercised by scrolling; no password reset or delete submitted. |
| Sign-in and create-account forms | 20 additional size/text combinations; no horizontal overflow. Actual member sign-in succeeded. |
| Member populated return history | 10 additional size/text combinations; no document overflow. |
| Mobile navigation | Open, Escape close, select-and-close and bottom navigation passed. Closed sidebar reports visibility hidden. |
| Scanner | Long book/member selections fit at 320px/200%; ArrowRight selects Quick Return and reveals its tab. Keyboard entry LOAN-0004 resolves the long-title active loan; confirmation remains reachable. Return was not submitted in this UI audit. Camera pause/start UI exercised; optical decoding not claimed. |
| Notifications | Empty and populated states checked. At 200% text, populated panel fits 320×568 (bottom 560) and 667×375 (bottom 367), with final item scrollable. |
| Themes and visual inspection | Desktop dark, mobile light, long catalog, landscape loan footer and enlarged notification screenshots inspected. Existing colors, artwork and typography preserved. |
| Browser console | Zero error entries at final inspection. |

Ignored artifacts: `output/playwright/responsive-page-audit.txt`, `responsive-dialog-audit.txt`, `responsive-desktop-dark.png`, `responsive-mobile-light.png`, `responsive-borrow-landscape-final.png`, `responsive-long-catalog-320.png`, `responsive-scanner-large-text.png`, `responsive-notifications-large-text.png`. CLI session: `responsive`. Temporary audit callbacks and fixture credentials are outside the repository; secrets were not added to tracked files.

## Automated checks
Run from `frontend`: `npm test` (**29 passed, 11 files**), `npm run typecheck`, `npm run build`. All passed. Run from repository root: `git diff --check` passed. No lint script exists; lint is not claimed. The Phase 7.1 report records **87 backend tests** from the preceding verification; this CSS-only follow-up did not change backend code or rerun Maven.

## Remaining manual verification
Check supported real mobile Safari/Chrome devices with touch input, browser text/zoom settings, on-screen keyboard, safe-area insets and rotation. Check notifications on browsers without CSS anchor positioning. Real camera permission, optical barcode/QR decoding, camera switching and actual USB-scanner hardware remain manual acceptance gates. Browser viewport simulation does not certify those devices.

The responsive implementation is ready for review within the verified Chromium scope. The broader production decision remains **NO-GO** for the independent gates in `PHASE_7_FINAL_VERIFICATION_REPORT.md`; these CSS fixes do not resolve deployment, identity/security or actual-data migration acceptance gates.

## Git handoff
No commit, push, merge, deployment or branch deletion performed. Suggested UI commit: `fix: keep library UI usable on narrow screens and enlarged text`.

Stage the UI changes and their documentation after review:

```sh
git add frontend/src/styles/components.css frontend/src/styles/layout.css docs/RESPONSIVE_UI_VERIFICATION.md docs/IMPLEMENTATION_ROADMAP.md
```

The two existing Phase 7 report edits remain preserved and also need review/staging: `docs/PHASE_7_FINAL_VERIFICATION_REPORT.md`, `docs/PHASE_7_STABILIZATION_REPORT.md`. The roadmap includes both Phase 7 and UI checkpoint changes; use patch staging if separating commits. Migrations V7–V9 remain tracked and unchanged.

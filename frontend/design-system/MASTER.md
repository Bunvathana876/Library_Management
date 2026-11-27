# Athenaeum — Editorial Library Design System (`MASTER.md`)

## 1. Visual Direction
**Athenaeum** is designed as a working university library and circulation desk ("Paper, Ink & Forest"). Surfaces use warm archival paper neutrals (`#faf9f6` canvas, `#f1f2eb` navigation rail, `#ffffff` elevated surfaces) in Light Mode and deep botanical slate (`#171e1a` canvas, `#1e2821` surface) in Dark Mode, anchored by a single **Forest Green** primary accent (`#285844` light / `#a4c8ae` dark). Book covers provide natural color and variety while administrative controls stay quiet, legible, and direct.

## 2. Token Architecture (`frontend/src/styles/tokens.css`)

1. **Spacing & Geometry**
   - 4px / 8px grid: `--space-1` (`4px`), `--space-2` (`8px`), `--space-3` (`12px`), `--space-4` (`16px`), `--space-5` (`20px`), `--space-6` (`24px`), `--space-8` (`32px`), `--space-10` (`40px`), `--space-12` (`48px`).
   - Restrained corners: `--radius-xs` (`3px`), `--radius-sm` (`4px`), `--radius-md` (`6px`), `--radius-lg` (`8px`). No oversized pills or nested card boxes.
   - Shadows reserved strictly for top-layer overlays (`--shadow-md`, `--shadow-lg`) and subtle physical book-cover depth; workspace sections divide via `1px` hairlines (`--border-subtle`, `--border-strong`).

2. **Semantic Color Roles & WCAG 2.2 AA Contrast**
   - **Light Mode (Default)**:
     - Canvas `#faf9f6`, Surface `#ffffff`, Muted `#f0efe9`, Sidebar `#f1f2eb`.
     - Ink hierarchy: `--text-primary` (`#222e29`, ~13.8:1), `--text-secondary` (`#535f56`, ~6.3:1), `--text-muted` (`#59645b`, >= 5.1:1).
     - Primary action: `--accent` (`#285844`) with `--accent-text` (`#ffffff`, 8.15:1).
   - **Dark Mode (`meta[name="color-scheme"][content="dark"]`)**:
     - Canvas `#171e1a`, Surface `#1e2821`, Muted `#273229`, Sidebar `#1c251e`.
     - Ink hierarchy: `--text-primary` (`#f0f0e6`), `--text-secondary` (`#c0c9be`), `--text-muted` (`#a8b5a7`, >= 5.8:1).
     - Primary action: `--accent` (`#a4c8ae`) with dark ink `--accent-text` (`#172e20`, 8.4:1).
   - **Semantic Status Tones**: `--success`, `--warning`, `--danger` (plus `--danger-solid` for high-contrast filled counters and destructive buttons), and `--info`.

3. **Typography**
   - **Editorial Headings & Book Titles**: `Newsreader` (`400`–`500`), `text-wrap: balance`.
   - **Interface & Controls**: `Inter` (`400`, `500`, `600`), `0.9375rem` (`15px`) base body with `1.55` line height, `text-wrap: pretty` on paragraphs.
   - **Identifiers & Counts**: System monospace (`--font-mono`) and `font-variant-numeric: tabular-nums` for call numbers (`CAT-0001`), copy barcodes (`CPY-0001-01`), member passes (`MEM-0001`), loan codes, dates, and currency.

## 3. Layout, Responsive Shell & Container Queries
- **Desktop (`>= 1024px`)**: `236px` sticky left rail (`Sidebar`) showing only role-permitted sections + `72px` `TopBar` + `1480px` max-width `page-content` container (`container: page / inline-size`).
- **Tablet (`768px–1023px`)**: Modal slide-out `Sidebar` drawer with focus containment, `inert` background locking, `Esc` dismissal, and focus restoration.
- **Mobile (`< 768px`)**: Safe-area-aware fixed `BottomNav` (`>= 44px` touch targets), horizontal-to-vertical shelf adaptation (`@container page`), and flat stacked ledger rows (`@container (width < 540px)`) without nested card borders.

## 4. Interaction, Honesty & Accessibility
- **Data Integrity**: Inventory summaries sum real physical-copy counts (`totalCopies`, `availableCopies`, `loanedCopies`, `onHoldCopies`) and surface unknown/loading/error states explicitly. Missing book covers render a typographic cover placeholder rather than unrelated stock art.
- **Confirmation Gates**: Fine settlement, fine waivers, reservation cancellations, copy deletions, member status changes, and admin account/job mutations require contextual confirmation via `useConfirmation`.
- **Top-Layer & Reduced Motion**: Native `<dialog>` modals/drawers and HTML `popover` notifications/toasts use `--backdrop-scrim` and discrete exit transitions, honoring `@media (prefers-reduced-motion: reduce)` and `@media (forced-colors: active)`.

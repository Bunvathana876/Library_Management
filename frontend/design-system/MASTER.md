# Athenaeum — Editorial Design System (`MASTER.md`)

## 1. Visual Direction
**Athenaeum Editorial Studio** combines warm archival parchment & stone surfaces (Light Mode) and deep obsidian-slate surfaces (Dark Mode) with **Deep Library Teal** (`#0F766E` / `#2DD4BF`) and **Warm Scholarly Brass** (`#B45309` / `#F59E0B`). Headings pair refined literary serif typography (`Cormorant Garamond` / `Newsreader`) with crisp geometric UI sans (`Plus Jakarta Sans`) and tabular monospace (`JetBrains Mono`) for catalog IDs, dates, and API paths.

## 2. Three-Layer Token Architecture
All visual properties live in [`tokens.css`](../src/styles/tokens.css):

1. **Primitive Tokens (`--teal-*`, `--brass-*`, `--stone-*`, `--obsidian-*`, `--space-*`, `--text-*`, `--radius-*`, `--duration-*`)**
   - 8-point / 4-point rhythm: `--space-1: 0.25rem` (4px), `--space-2: 0.5rem` (8px), `--space-3: 0.75rem` (12px), `--space-4: 1rem` (16px), `--space-5: 1.25rem` (20px), `--space-6: 1.5rem` (24px), `--space-8: 2rem` (32px), `--space-12: 3rem` (48px).
   - Icon sizing discipline: `--icon-sm: 1rem` (16px), `--icon-md: 1.25rem` (20px), `--icon-lg: 1.5rem` (24px).
2. **Semantic Tokens (`--bg-canvas`, `--bg-surface`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--brass`, `--success`, `--warning`, `--danger`, `--info`, `--spine-1`..`--spine-6`)**
   - Light/Dark polarity driven via `light-dark()` inside `@supports` with `@media (prefers-color-scheme: dark)` fallback and `:root:has(> head > meta[name="color-scheme"])` user override reflection.
   - Contrast targets: normal text `>= 4.5:1` (`#131F1C` on `#FFFFFF` / `#F6F3EC`, `#EFF5F3` on `#111A18` / `#0A100F`, muted dark `#97ACA5` on `#111A18` >= 6.4:1).
3. **Component Tokens (`--btn-*`, `--card-*`, `--input-*`, `--modal-*`, `--table-*`, `--nav-*`, `--badge-*`)**
   - Uniform height, radius, padding, and border semantics across buttons, inputs, cards, native `<dialog>` modals, and responsive tables.

## 3. Typography Scale & Wrapping
- Display / Hero Heading: `Cormorant Garamond`, `clamp(1.65rem, 2.8vw, 2.35rem)`, `line-height: 1.12`, `text-wrap: balance`.
- Editorial Card / Book Title: `Newsreader`, `1.2rem`, `font-weight: 600`, `text-wrap: balance`.
- Body / Controls: `Plus Jakarta Sans`, `0.9375rem` (15px), `line-height: 1.55`.
- Metadata / Call Numbers / Dates: `JetBrains Mono`, `font-variant-numeric: tabular-nums`.
- Descriptions & Paragraphs: `text-wrap: pretty` to avoid awkward single-word orphans.

## 4. Layout & Breakpoints
- **Desktop (`>= 1024px`)**: `272px` sticky left rail (`Sidebar`) + `72px` translucent sticky `TopBar` + `1360px` max-width workspace canvas.
- **Tablet (`768px–1023px`)**: Slide-out navigation drawer with explicit close control and `Esc` dismissal; responsive 2-column grids.
- **Mobile (`< 768px`)**: Safe-area-aware sticky `BottomNav` (`>= 44px` touch targets), stacked `@container` data tables (`< 540px`), and bottom clearance (`--bottom-nav-height + env(safe-area-inset-bottom)`).

## 5. Interaction, Motion & Accessibility
- **Top-Layer Animation**: Native `<dialog>` uses `@starting-style`, `overlay`, and `transition-behavior: allow-discrete` with an explicit `data-closing` + `getAnimations()` fallback for Firefox/Safari.
- **Reduced Motion**: Non-essential transforms and stagger entrances disable automatically inside `@media (prefers-reduced-motion: reduce)`.
- **WCAG 2.2 AA**: `scroll-padding-top` prevents sticky topbar focus occlusion; forms surface a focusable `ErrorSummary` on failed submit while keeping `:user-invalid` inline errors linked via `aria-describedby`.

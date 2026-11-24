# Library Management Frontend (`frontend/`)

React 19 + TypeScript + Vite web interface for the Spring Boot Library Management API.

## Directory Guide

- `src/api/` — Typed fetch wrappers mapped 1-to-1 to the backend controllers (`AuthController`, `BookController`, `MemberController`, `LoanController`, `AdminAccountController`, and Spring Actuator).
- `src/components/forms/` — Modal workflows (`SignInModal`, `BookFormModal`, `BookDetailModal`, `BorrowBookModal`, `MemberFormModal`).
- `src/components/layout/` — `Sidebar` (navigation, live API health badge, JWT session card) and `TopBar` (page title, contextual actions, light/dark toggle).
- `src/components/ui/` — Accessible native `<dialog>` wrapper, confirmation modal, status badges, KPI cards, and top-layer `popover="manual"` toast notifications.
- `src/context/` — `AuthContext`, `ThemeContext`, and `ToastContext`.
- `src/pages/` — `OverviewPage`, `BooksPage`, `LoansPage`, `MembersPage`, and `AdminUsersPage`.
- `src/styles/` — Design tokens (`light-dark()` + `prefers-color-scheme`), base typography, component primitives, and responsive layout CSS.
- `src/types/` — Exact TypeScript contracts for backend DTOs and `ProblemDetail` errors.
- `src/utils/` — `Temporal.PlainDate` calendar date formatting/diffing, error parsing, role helpers, and ARIA validation sync.

## Scripts

```bash
npm run dev        # Start Vite dev server on http://127.0.0.1:5173 with proxy to :8080
npm run typecheck  # Run TypeScript compiler type check
npm run test       # Run Vitest unit tests
npm run build      # Typecheck and build production bundle to dist/
npm run preview    # Preview production build on http://127.0.0.1:4173 with proxy to :8080
```

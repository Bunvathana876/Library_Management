# Library Management System

Full-stack Library Management System organized cleanly into two folders:
- [`backend/`](./backend/) — **Spring Boot 4 / Java 21 / PostgreSQL** REST API
- [`frontend/`](./frontend/) — **React 19 + TypeScript + Vite** Web UI

---

## Project Folder Structure

```text
library-management/
├── backend/                              # Spring Boot REST API
│   ├── src/
│   │   ├── main/java/com/library/management/
│   │   │   ├── config/                   # SecurityConfig, JwtConfig, LocalAdminBootstrap
│   │   │   ├── controller/               # Auth, AdminAccount, Book, Member, Loan endpoints
│   │   │   ├── dto/                      # Request & response Java records
│   │   │   ├── exception/                # ProblemDetail global error handling
│   │   │   ├── model/                    # JPA entities (Book, Member, Loan, AppUser)
│   │   │   ├── repository/               # Spring Data JPA repositories
│   │   │   └── service/                  # Business rules & transactions
│   │   ├── main/resources/
│   │   │   ├── application.properties    # Imports .env or ../.env automatically
│   │   │   └── db/migration/             # Flyway SQL migrations (V1–V3)
│   │   └── test/                         # Unit & Testcontainers integration tests
│   ├── Dockerfile                        # Multi-stage Maven + Temurin 21 backend image
│   ├── pom.xml                           # Maven project definition
│   └── mvnw / mvnw.cmd                   # Maven Wrapper
│
├── frontend/                             # React + TypeScript Web UI (mirrors backend)
│   ├── public/favicon.svg                # App icon
│   ├── src/
│   │   ├── api/                          # 1-to-1 clients matching Spring controllers
│   │   │   ├── httpClient.ts             # JWT header injection & ProblemDetail parser
│   │   │   ├── authApi.ts                # -> AuthController (/api/auth/*)
│   │   │   ├── booksApi.ts               # -> BookController (/api/books/*)
│   │   │   ├── membersApi.ts             # -> MemberController (/api/members)
│   │   │   ├── loansApi.ts               # -> LoanController (/api/loans/*)
│   │   │   ├── adminApi.ts               # -> AdminAccountController (/api/admin/users)
│   │   │   └── healthApi.ts              # -> Actuator (/actuator/health)
│   │   ├── components/
│   │   │   ├── forms/                    # SignIn, BookForm, BookDetail, Borrow, Member modals
│   │   │   ├── layout/                   # Sidebar navigation & TopBar
│   │   │   └── ui/                       # Native <dialog>, ConfirmDialog, Badges, Toasts
│   │   ├── context/                      # AuthContext (JWT), ThemeContext, ToastContext
│   │   ├── pages/                        # Overview, Books, Loans, Members, AdminUsers
│   │   ├── styles/                       # Design tokens, base, components & layout CSS
│   │   ├── types/                        # TypeScript interfaces matching Java DTOs
│   │   └── utils/                        # Temporal PlainDate helpers, roles & error parsing
│   ├── nginx.conf                        # Optional production SPA + /api reverse proxy
│   └── vite.config.ts                    # Dev/preview proxy (/api & /actuator -> :8080)
│
├── .env.example                          # Environment template (copy to .env)
├── compose.yaml                          # PostgreSQL 17 + backend/ Spring Boot Docker stack
└── README.md                             # Project overview & run guide
```

---

## How Frontend Connects to Backend

```text
Browser (http://127.0.0.1:5173)
   │
   ├── GET /api/books, POST /api/auth/login, ...
   └── GET /actuator/health
   ▼
Vite Reverse Proxy (frontend/vite.config.ts)
   │   Forwards /api/* and /actuator/* -> http://127.0.0.1:8080
   ▼
Spring Boot API (127.0.0.1:8080)
   │   Validates HS256 JWT tokens & executes business logic
   ▼
PostgreSQL 17 (127.0.0.1:5545)
```

Because Vite proxies `/api` and `/actuator` on the same origin (`127.0.0.1:5173`), no backend CORS changes are required.

---

## Running Locally

### 1. Start the Spring Boot Backend + PostgreSQL
Ensure `.env` is configured at the project root (see `.env.example`), then run:

```bash
docker compose up -d
```

Or run PostgreSQL via Docker and start Spring Boot directly from `backend/`:

```bash
docker compose up -d db
cd backend && ./mvnw spring-boot:run
```

Run backend unit & integration tests from `backend/`:

```bash
cd backend && ./mvnw -B verify
```

Verify the backend is healthy:

```bash
curl http://127.0.0.1:8080/actuator/health
```

### 2. Start the Frontend Web UI

```bash
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:5173** in your browser.

- **Public Catalog**: Browse and search books immediately without signing in.
- **Staff / Admin Features**: Click **Sign In** and use the `LIBRARY_ADMIN_EMAIL` and `LIBRARY_ADMIN_PASSWORD` configured in your local `.env`.

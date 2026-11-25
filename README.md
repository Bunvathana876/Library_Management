# 📚 Library Management System

[![Java](https://img.shields.io/badge/Java-21-orange.svg?logo=openjdk)](https://openjdk.org/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.0%20(Milestone)-brightgreen.svg?logo=springboot)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.3-purple.svg?logo=vite)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791.svg?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?logo=docker)](https://www.docker.com/)
[![CI](https://github.com/Bunvathana876/Library_Management/actions/workflows/ci.yml/badge.svg)](https://github.com/Bunvathana876/Library_Management/actions)

A modern, production-ready full-stack Library Management System engineered with **Spring Boot 4 / Java 21** REST API and a **React 19 + TypeScript** web interface.

The application allows libraries to manage book collections, member registrations, and borrowing lifecycles with strict role-based security, automated Flyway database migrations, and responsive UI design.

---

## 📑 Table of Contents

- [Overview & Architecture](#-overview--architecture)
- [Folder Structure](#-folder-structure)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Quickstart Guide](#-quickstart-guide)
  - [Prerequisites](#prerequisites)
  - [1. Environment Setup](#1-environment-setup)
  - [2. Option A: Run with Docker Compose (Fastest)](#2-option-a-run-with-docker-compose-fastest)
  - [3. Option B: Run for Local Development](#3-option-b-run-for-local-development-hot-reloading)
- [Default Admin Credentials](#-default-admin-credentials)
- [REST API Reference](#-rest-api-reference)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Configuration & Environment Variables](#-configuration--environment-variables)
- [CI/CD Pipeline](#-cicd-pipeline)

---

## 🏛 Overview & Architecture

The application is structured into two clean workspaces:
- **`backend/`**: Stateless Spring Boot REST service handling business logic, data persistence, Flyway migrations, and HS256 JWT security.
- **`frontend/`**: Fast React 19 Single Page Application built with Vite, TypeScript, and accessible CSS tokens.

```text
Browser (http://127.0.0.1:5173)
   │
   ├── UI User Actions, Modals & Toast Alerts
   └── API Requests (/api/*) & Health Checks (/actuator/health)
   ▼
Vite Reverse Proxy (Local Dev) / Nginx (Production)
   │   Forwards /api/* and /actuator/* to backend on :8080
   ▼
Spring Boot REST API (http://127.0.0.1:8080)
   │   Validates HS256 JWT tokens & verifies role permissions
   │   Enforces business rules (e.g. loan limits, duplicate check, stock)
   ▼
PostgreSQL 17 Database (127.0.0.1:5545 or Docker internal :5432)
   │   Flyway versioned schema migrations (V1, V2, V3)
```

> **Note on CORS**: Because Vite (in development) and Nginx (in production) proxy `/api` and `/actuator` requests on the same origin, no complex CORS configurations or cookie handling issues occur.

---

## 📂 Folder Structure

```text
library-management/
├── backend/                              # Spring Boot REST API
│   ├── src/
│   │   ├── main/java/com/library/management/
│   │   │   ├── config/                   # SecurityConfig, JwtConfig, LocalAdminBootstrap
│   │   │   ├── controller/               # Auth, AdminAccount, Book, Member, Loan endpoints
│   │   │   ├── dto/                      # Java records for request validation & responses
│   │   │   ├── exception/                # Global RFC 7807 / RFC 9457 ProblemDetail handler
│   │   │   ├── model/                    # JPA entities: Book, Member, Loan, AppUser
│   │   │   ├── repository/               # Spring Data JPA repositories
│   │   │   └── service/                  # Business logic & transactional services
│   │   ├── main/resources/
│   │   │   ├── application.properties    # Base configuration + .env auto-loader
│   │   │   └── db/migration/             # Flyway SQL migrations (V1_books, V2_members_loans, V3_users)
│   │   └── test/                         # JUnit 5 & Testcontainers PostgreSQL integration tests
│   ├── Dockerfile                        # Multi-stage Temurin 21 container image
│   ├── pom.xml                           # Maven project dependencies
│   └── mvnw / mvnw.cmd                   # Maven Wrapper executables
│
├── frontend/                             # React 19 + TypeScript + Vite UI
│   ├── public/                           # Static assets, covers & favicon
│   ├── src/
│   │   ├── api/                          # Strongly typed API clients matching Spring controllers
│   │   ├── components/
│   │   │   ├── forms/                    # Modals: SignIn, BookForm, BookDetail, Borrow, Member
│   │   │   ├── layout/                   # Sidebar, TopBar, BottomNav
│   │   │   └── ui/                       # Accessible <dialog>, ConfirmDialog, StatCard, Toasts
│   │   ├── context/                      # AuthContext (JWT session), ThemeContext, ToastContext
│   │   ├── pages/                        # Overview, Books, Loans, Members, AdminUsers
│   │   ├── styles/                       # CSS design tokens, light-dark() theme, layout primitives
│   │   ├── types/                        # TypeScript types reflecting Java DTO records
│   │   └── utils/                        # Temporal PlainDate helpers, role checks, form validation
│   ├── nginx.conf                        # Production SPA reverse-proxy configuration
│   └── vite.config.ts                    # Vite dev server with /api and /actuator proxy
│
├── .github/workflows/ci.yml              # GitHub Actions CI for backend + frontend
├── .env.example                          # Template for secrets and credentials
├── compose.yaml                          # PostgreSQL 17 + Spring Boot API Docker setup
└── README.md                             # Project documentation
```

---

## ✨ Key Features

- **📖 Multi-Copy Book Catalog, Categories & Shelf Locations**:
  - Full CRUD on catalog titles (`title`, `author`, `isbn`, `publicationYear`, `publisher`, `category`, `shelfLocation`, `coverUrl`) and physical copy inventory tracking (`book_copies` with barcodes like `CPY-0001-01`, statuses `AVAILABLE`, `LOANED`, `ON_HOLD`, `DAMAGED`, `LOST`).
  - **Instant ISBN Auto-Fill (Open Library API)**: Typing, pasting, or scanning an ISBN automatically pulls verified metadata and cover artwork.
  - Real-time search and faceted filtering by availability, category/genre, and publication year.

- **👥 Full Member & Account Lifecycle**:
  - Public member self-registration (`POST /api/auth/register`) and self-service password updates (`POST /api/auth/change-password`).
  - Staff member directory with phone/notes, edit profile, active/inactive status toggle, safe deletion checks, standing indicators, and a **Patron Standing & History Drawer**.
  - Admin controls in **Staff & Accounts** to enable/disable accounts, reassign `LIBRARIAN`/`MEMBER` roles, reset passwords, and trigger scheduled reminder jobs manually.

- **🔁 Borrowing Limits, Overdue Fines & Camera Scanner**:
  - Configurable borrowing limit (default `5` active loans), automatic `$0.50/day` overdue fine accrual & return assessment, circulation desk **Fines & Standing** ledger (`Mark Paid` / `Waive`), and checkout/renewal blocks when unpaid fines reach `$10.00`.
  - **Loan Renewals (+14 Days)** up to 2 times unless blocked by active holds or unpaid fines.
  - **Camera Barcode & QR Code Scanner** supporting ISBN barcodes, `CAT-xxxx`, `CPY-xxxx-xx`, `MEM-xxxx`, and `LOAN-xxxx`.
  - **Reservations & Holds Queue**: FIFO waiting queue with automatic desk promotion (`READY_FOR_PICKUP`, 3-day pickup window).

- **📚 Member Self-Service Portal ("My Bookshelf") & Notifications**:
  - Personalized member portal with active loans, due-date countdowns, unpaid fines & standing alerts, `+14d` renewals, hold queue status, return history, and scannable Member QR pass (`MEM-xxxx`).
  - **Scheduled Jobs & Notification Center**: `@Scheduled` jobs for nightly ready-hold expiration (`02:00`) and daily due-soon/overdue alerts (`08:00`), surfaced via a top-bar notification bell popover and optional SMTP / Mailpit email alerts.

- **🛡️ Authentication & Role-Based Access Control (RBAC)**:
  - Stateless authentication with HS256 JWT tokens via `Authorization: Bearer <token>` headers.
  - Three user roles:
    - `USER`: Read-only access to browse and search the book catalog.
    - `LIBRARIAN`: Manage books, register members, and issue/return loans.
    - `ADMIN`: Full system access, including managing librarian and administrator accounts.
  - Automatic local admin account bootstrap on first startup.

- **🎨 Modern & Accessible UI**:
  - Built with React 19 and modern CSS with light/dark theme switching via `light-dark()`.
  - Accessible native `<dialog>` wrappers with keyboard navigation (Esc, focus trap).
  - Non-blocking toast notifications using HTML `popover="manual"`.
  - Live system health status badge querying `/actuator/health`.

- **🧪 Enterprise Quality & Testing**:
  - Spring Boot 4 unit and integration tests using **Testcontainers** with real PostgreSQL instances.
  - Vitest + TypeScript typecheck for frontend correctness.
  - RFC 7807 `ProblemDetail` standard error responses.

---

## 🛠 Tech Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | Spring Boot | 4.0.0-M3 | Core enterprise REST API framework |
| **Language** | Java | 21 (LTS) | Modern language features (Records, Pattern Matching) |
| **Security** | Spring Security & OAuth2 Resource Server | 6.x | Stateless JWT authentication and role enforcement |
| **Database** | PostgreSQL | 17 | Relational persistence with foreign key integrity |
| **Migrations** | Flyway | 11.x | Version-controlled, reproducible SQL database migrations |
| **Testing** | JUnit 5 & Testcontainers | 2.x | Real containerized integration tests |
| **Frontend Framework**| React | 19.1.0 | Component-based interactive UI |
| **Language** | TypeScript | 5.8 | Full type safety matching backend DTOs |
| **Build Tool** | Vite | 6.3 | Ultra-fast development server and optimized bundle builder |
| **Icons & Polyfills** | Lucide React / Temporal | Latest | Clean UI iconography & ISO date handling |
| **Unit Testing (UI)**| Vitest | 5.1 | Fast in-memory unit testing for utils & validation |
| **Containers** | Docker & Docker Compose | Latest | Standardized containerization for Frontend, API and Database |

---

## 🚀 Quickstart Guide

### Prerequisites
Make sure you have the following installed on your system:
- **Java 21 JDK** (e.g. Eclipse Temurin 21)
- **Node.js 20+** and **npm**
- **Docker** and **Docker Compose**

---

### 1. Environment Setup

Clone the repository and create your local `.env` configuration file from the template:

```bash
git clone https://github.com/Bunvathana876/Library_Management.git
cd Library_Management
cp .env.example .env
```

Open `.env` and fill in your values. For the JWT secret, generate a secure 256-bit base64-encoded string:

```bash
# Generate a secure 32-byte (256-bit) secret on macOS / Linux:
openssl rand -base64 32
```

Sample `.env` file:
```ini
# PostgreSQL credentials
LIBRARY_DB_PASSWORD=your_secure_db_password

# Spring Boot profiles and JWT signing secret
SPRING_PROFILES_ACTIVE=local
LIBRARY_JWT_SECRET_BASE64=your_generated_base64_secret_here

# Initial administrator bootstrap credentials
LIBRARY_ADMIN_EMAIL=admin@library.local
LIBRARY_ADMIN_PASSWORD=change-me-admin-password
```

---

### 2. Option A: Run Full Stack with Docker Compose (Fastest)

To launch the complete system (PostgreSQL database, Spring Boot API, and Nginx React frontend):

```bash
# Build and start all three services in the background
docker compose up -d --build
```

- **Frontend Web UI**: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- **Spring Boot REST API**: [http://127.0.0.1:8080](http://127.0.0.1:8080)
- **Actuator Health**: [http://127.0.0.1:8080/actuator/health](http://127.0.0.1:8080/actuator/health)
- **PostgreSQL Database**: `127.0.0.1:5545` (internal `5432`)


---

### 3. Option B: Run for Local Development (Hot Reloading)

If you are developing backend or frontend features locally:

#### Step 1: Start only PostgreSQL in Docker
```bash
docker compose up -d db
```
*(PostgreSQL runs on port `127.0.0.1:5545`)*

#### Step 2: Start Spring Boot REST API
```bash
cd backend
./mvnw spring-boot:run
```
*(The backend API starts on port `127.0.0.1:8080`)*

Verify that the backend is healthy:
```bash
curl http://127.0.0.1:8080/actuator/health
# {"status":"UP"}
```

#### Step 3: Start the Frontend UI
```bash
cd frontend
npm install
npm run dev
```
*(The Vite dev server starts on `http://127.0.0.1:5173` with automatic API proxying to port `8080`)*

---

## 🔑 Default Admin Credentials

When running with `SPRING_PROFILES_ACTIVE=local`, the system automatically bootstraps an initial administrator account using the values configured in your `.env` file:

- **Email**: `admin@library.local`
- **Password**: `change-me-admin-password` (or what you configured in `.env`)
- **Role**: `ADMIN`

To sign in:
1. Open the UI at **http://127.0.0.1:5173**.
2. Click **Sign In** in the top navigation bar.
3. Enter the email and password above.
4. You now have full access to create librarian accounts, add books, register members, and manage loans!

---

## 📡 REST API Reference

All protected endpoints require an HTTP header:
`Authorization: Bearer <your_jwt_token>`

### 1. Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | **Public** | Authenticate with email & password; returns HS256 JWT access token |
| `POST` | `/api/auth/register` | **Public** | Self-register a new `MEMBER` account and linked borrower profile |
| `POST` | `/api/auth/change-password` | **Authenticated** | Change password for the currently authenticated user |
| `GET` | `/api/auth/me` | **Authenticated** | Returns current user subject email and granted roles |

### 2. Books & Physical Copies (`/api/books`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/books` | **Public** | List books with optional `?search=` and `?category=` filters |
| `GET` | `/api/books/categories` | **Public** | List distinct catalog categories |
| `GET` | `/api/books/{id}` | **Public** | Get detailed information & copy counts for a specific book |
| `GET` | `/api/books/{id}/copies` | **Public** | List individual physical copies and barcodes for a title |
| `POST` | `/api/books/{id}/copies` | **STAFF / ADMIN** | Add a new physical copy (`CPY-xxxx-xx` or custom barcode) |
| `PATCH` | `/api/books/{id}/copies/{copyId}` | **STAFF / ADMIN** | Update copy shelf location, condition notes, or `AVAILABLE`/`DAMAGED`/`LOST` status |
| `DELETE` | `/api/books/{id}/copies/{copyId}` | **STAFF / ADMIN** | Remove an unused extra physical copy |
| `GET` | `/api/books/isbn/{isbn}` | **STAFF / ADMIN** | Look up verified metadata & cover artwork by ISBN-10 / ISBN-13 via Open Library |
| `POST` | `/api/books` | **STAFF / ADMIN** | Create a new book (supports `category`, `shelfLocation`, `initialCopies`) |
| `PUT` | `/api/books/{id}` | **STAFF / ADMIN** | Update existing book attributes |
| `DELETE` | `/api/books/{id}` | **STAFF / ADMIN** | Delete a book by ID |

### 3. Members (`/api/members`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/members` | **STAFF / ADMIN** | List all registered library members with borrowing standing & unpaid fines |
| `GET` | `/api/members/{id}` | **STAFF / ADMIN** | Get full patron profile, active/returned loans, fines, and hold history |
| `POST` | `/api/members` | **STAFF / ADMIN** | Register a new library member |
| `PUT` | `/api/members/{id}` | **STAFF / ADMIN** | Update member name, email, phone, and staff notes |
| `PATCH` | `/api/members/{id}/status` | **STAFF / ADMIN** | Activate or deactivate a member profile |
| `DELETE` | `/api/members/{id}` | **STAFF / ADMIN** | Delete a member with no loan history or active holds |

### 4. Loans & Fines (`/api/loans`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/loans/active` | **STAFF / ADMIN** | List all currently active (unreturned) loans |
| `GET` | `/api/loans/overdue` | **STAFF / ADMIN** | List all overdue loans with live fine accrual |
| `GET` | `/api/loans/fines` | **STAFF / ADMIN** | List active accruing overdue loans and settled/unpaid fine records |
| `GET` | `/api/loans/{id}` | **STAFF / ADMIN** | Get details for a specific loan |
| `POST` | `/api/loans` | **STAFF / ADMIN** | Borrow an available copy (`bookId`, `memberId`, optional `copyId`) |
| `POST` | `/api/loans/{id}/return` | **STAFF / ADMIN** | Return a loan, assess any overdue fine, and promote waiting hold if queued |
| `POST` | `/api/loans/{id}/renew` | **STAFF / ADMIN** | Renew an active loan (+14 days, max 2, blocked by holds or unpaid fines) |
| `POST` | `/api/loans/{id}/fine/pay` | **STAFF / ADMIN** | Record payment for an unpaid returned-loan fine |
| `POST` | `/api/loans/{id}/fine/waive` | **STAFF / ADMIN** | Waive an unpaid returned-loan fine |

### 5. Member Self-Service, Notifications & Holds (`/api/me`, `/api/holds`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/me/bookshelf` | **Authenticated** | Get active loans, return history, unpaid fines, standing limits, holds, and card ID |
| `POST` | `/api/me/loans/{id}/renew` | **Authenticated** | Self-service 14-day renewal on own loan |
| `GET` | `/api/me/notifications` | **Authenticated** | List up to 30 recent notifications and unread badge count |
| `POST` | `/api/me/notifications/{id}/read` | **Authenticated** | Mark a single notification as read |
| `POST` | `/api/me/notifications/read-all` | **Authenticated** | Mark all unread notifications as read |
| `POST` | `/api/holds` | **Authenticated** | Place a FIFO reservation hold on a loaned-out or held book |
| `POST` | `/api/holds/{id}/cancel` | **Authenticated** | Cancel own hold (or any hold for staff), promoting next in queue |
| `GET` | `/api/holds/active` | **STAFF / ADMIN** | List all ready pickups and FIFO waiting holds |
| `POST` | `/api/holds/{id}/fulfill` | **STAFF / ADMIN** | Convert a ready-for-pickup hold into an active 14-day loan |

### 6. Administration & Jobs (`/api/admin`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/users` | **ADMIN** | List all registered user accounts, roles, and enabled state |
| `POST` | `/api/admin/users` | **ADMIN** | Provision new user accounts (`LIBRARIAN` or `MEMBER`) |
| `PATCH` | `/api/admin/users/{id}/status` | **ADMIN** | Enable or disable a login account |
| `PATCH` | `/api/admin/users/{id}/role` | **ADMIN** | Reassign account role between `LIBRARIAN` and `MEMBER` |
| `POST` | `/api/admin/users/{id}/reset-password` | **ADMIN** | Reset a user account password |
| `POST` | `/api/admin/jobs/run-reminders` | **ADMIN** | Trigger hold-expiration and due-soon/overdue reminder jobs manually |

### 6. Interactive API Documentation
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/swagger-ui.html` | **Public** | Interactive OpenAPI / Swagger UI playground and documentation |
| `GET` | `/v3/api-docs` | **Public** | Raw OpenAPI JSON specification |

### 7. System Health
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/actuator/health` | **Public** | Spring Boot Actuator application and database health status |

---

## 🧪 Testing & Quality Assurance

### Backend Tests
Execute unit and Testcontainers integration tests from the `backend/` directory:

```bash
cd backend

# Run fast unit tests
./mvnw test

# Run full suite including Testcontainers PostgreSQL integration tests
./mvnw -B verify
```

### Frontend Checks
Run TypeScript static verification, unit tests, and production build checks:

```bash
cd frontend

# Verify TypeScript types
npm run typecheck

# Run unit tests with Vitest
npm test

# Build production bundle
npm run build
```

---

## ⚙️ Configuration & Environment Variables

| Variable | Required | Default in `.env.example` | Description |
| :--- | :---: | :--- | :--- |
| `LIBRARY_DB_PASSWORD` | **Yes** | `change-me-db-password` | PostgreSQL database user password |
| `SPRING_PROFILES_ACTIVE` | No | `local` | Active Spring profile (enables local admin bootstrap) |
| `LIBRARY_JWT_SECRET_BASE64` | **Yes** | `replace-with-base64-encoded-32-byte-secret` | 256-bit Base64 secret key for HS256 JWT signature verification |
| `LIBRARY_ADMIN_EMAIL` | **Yes** | `admin@library.local` | Email address for bootstrapped administrator |
| `LIBRARY_ADMIN_PASSWORD` | **Yes** | `change-me-admin-password` | Initial password (min. 12 characters) for bootstrapped admin |

---

## 🔄 CI/CD Pipeline

The repository includes a GitHub Actions workflow in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) that triggers automatically on pushes and pull requests to `main`:

1. **Backend Tests Job**:
   - Provisions Ubuntu environment with Java 21 Temurin.
   - Leverages Docker for real Testcontainers integration tests.
   - Executes `./mvnw -B verify`.

2. **Frontend Tests Job**:
   - Provisions Node.js 20 environment.
   - Installs dependencies using `npm ci`.
   - Runs TypeScript type checking (`tsc --noEmit`), Vitest suite, and production build (`vite build`).

---

## 📄 License

This project is open-source and available under the standard MIT License.

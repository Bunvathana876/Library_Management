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

- **📖 Book Catalog Management**:
  - Full CRUD operations on books (Title, Author, ISBN, Publication Year, Copies).
  - Real-time search by title, author, or ISBN.
  - Availability tracking (Available vs. On Loan).
  - Public catalog browsing for guests without authentication.

- **👥 Member Directory**:
  - Member registration with validation (Full Name, Email, Phone Number, Join Date).
  - Search and filter registered library members.

- **🔁 Borrowing & Loan Lifecycle**:
  - Issue book loans with automated return due dates.
  - Return processing with book inventory replenishment.
  - Active loan monitoring and real-time overdue loan tracking.
  - Enforced business rules (prevent borrowing unavailable books or exceeding loan limits).

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
| **Unit Testing (UI)**| Vitest | 3.1 | Fast in-memory unit testing for utils & validation |
| **Containers** | Docker & Docker Compose | Latest | Standardized containerization for API and Database |

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

### 2. Option A: Run with Docker Compose (Fastest)

To launch the database and the backend API together in containers:

```bash
# Build and start all services in the background
docker compose up -d --build
```

Then start the frontend web client:

```bash
cd frontend
npm install
npm run dev
```

Visit **http://127.0.0.1:5173** in your web browser.

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
| `GET` | `/api/auth/me` | **Authenticated** | Returns current user subject email and granted roles |

### 2. Books (`/api/books`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/books` | **Public** | List books with optional `?search=` filter (title, author, ISBN) |
| `GET` | `/api/books/{id}` | **Public** | Get detailed information for a specific book |
| `POST` | `/api/books` | **STAFF / ADMIN** | Create a new book |
| `PUT` | `/api/books/{id}` | **STAFF / ADMIN** | Update existing book attributes |
| `DELETE` | `/api/books/{id}` | **STAFF / ADMIN** | Delete a book by ID |

### 3. Members (`/api/members`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/members` | **STAFF / ADMIN** | List all registered library members |
| `POST` | `/api/members` | **STAFF / ADMIN** | Register a new library member |

### 4. Loans (`/api/loans`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/loans/active` | **STAFF / ADMIN** | List all currently active (unreturned) loans |
| `GET` | `/api/loans/overdue` | **STAFF / ADMIN** | List all overdue loans |
| `GET` | `/api/loans/{id}` | **STAFF / ADMIN** | Get details for a specific loan |
| `POST` | `/api/loans` | **STAFF / ADMIN** | Borrow a book for a member (`bookId`, `memberId`, `dueDate`) |
| `POST` | `/api/loans/{id}/return` | **STAFF / ADMIN** | Mark an active loan as returned and replenish stock |

### 5. Administration (`/api/admin/users`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/admin/users` | **ADMIN** | Provision new user accounts with roles (`LIBRARIAN` or `ADMIN`) |

### 6. System Health
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

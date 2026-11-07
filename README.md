# IT Asset Management System — Phase P03 (Single Administrator Authentication)

A production-oriented full-stack IT Asset Management Web Application, designed for independent local deployment on Ubuntu Linux (including WSL2 and private VMs) and developed in Google AI Studio.

---

## 1. Architecture Overview (Modular Monolith)

This repository implements **Phase P03 — Single Administrator Authentication** on top of the Phase P01 foundation and Phase P02 PostgreSQL data architecture. It establishes secure initial administrator provisioning, Argon2id password hashing, server-side session management with PostgreSQL persistence, CSRF protections, and route authentication middleware without introducing premature frontend UI or asset business logic.

### Directory Structure

```
├── .env.example              # Non-secret environment variable template (including DATABASE_URL, SESSION_SECRET)
├── .gitignore                # Source control exclusions
├── index.html                # HTML entry point (title, meta, root mount)
├── metadata.json             # AI Studio applet metadata
├── package.json              # Project manifest, dependencies, and lifecycle scripts
├── package-lock.json         # Deterministic npm dependency lockfile
├── tsconfig.json             # TypeScript compiler configuration (client, server, test)
├── vite.config.ts            # Vite client bundler and plugin configuration
├── server.ts                 # Full-stack entry point (dev middleware / prod static)
├── README.md                 # Project, database, and authentication documentation (this file)
│
├── prisma/                   # PostgreSQL schema & versioned migrations (Prisma ORM)
│   ├── schema.prisma         # Declarative PostgreSQL data model (including AdminCredential and Session)
│   └── migrations/
│       ├── 20261107000000_init_postgresql_schema/
│       │   └── migration.sql # Initial data model with constraints & indexes
│       └── 20261107000001_add_session_storage/
│           └── migration.sql # Additive PostgreSQL session storage table
│
├── server/                   # Backend application (Node.js + Express + TypeScript)
│   ├── app.ts                # Express application factory, session, CSRF & routing middleware
│   ├── auth/                 # Authentication services & security modules
│   │   ├── bootstrapService.ts # Single-administrator provisioning logic & idempotency check
│   │   ├── password.ts       # Argon2id password hashing & input validation
│   │   ├── rateLimiter.ts    # IP sliding-window rate limiter & account lockout tracker
│   │   └── sessionStore.ts   # PostgreSQL Prisma-backed session store
│   ├── config/
│   │   └── environment.ts    # Typed environment loader (PORT, HOST, NODE_ENV, SESSION_SECRET, COOKIE_SECURE)
│   ├── db/
│   │   └── client.ts         # PrismaClient database connection singleton
│   ├── middleware/
│   │   ├── csrf.ts           # CSRF token validation and cross-origin origin/referer guard
│   │   ├── errorHandler.ts   # Centralized error handling middleware
│   │   └── requireAdmin.ts   # Reusable route protection middleware
│   ├── routes/
│   │   ├── auth.ts           # Auth endpoints (/api/auth/login, /logout, /me, /csrf, /register)
│   │   └── health.ts         # Diagnostic GET /health endpoint
│   ├── scripts/
│   │   └── bootstrapAdmin.ts # Interactive CLI command for initial administrator provisioning
│   └── types/
│       └── session.d.ts      # TypeScript augmentation for express-session and request context
│
├── src/                      # Frontend application (React 19 + TypeScript)
│   ├── App.tsx               # Minimal neutral application bootstrap
│   ├── index.css             # Base stylesheet reset
│   └── main.tsx              # React DOM root bootstrapping
│
└── test/                     # Test suites (node:test + node:assert)
    ├── auth-bootstrap.test.ts # Single-admin bootstrap and idempotency tests
    ├── auth-endpoints.test.ts # Login, logout, me, CSRF, and registration denial tests
    ├── auth-password.test.ts  # Argon2id hashing, verification, and input validation tests
    ├── database-schema.test.ts # Schema integrity, constraints & relationship tests
    └── health.test.ts         # Health check and environment configuration tests
```

---

## 2. Authentication & Security Architecture (Phase P03)

### 2.1 Single Administrator Provisioning (`npm run admin:bootstrap`)
- **Strict Single-Admin Rule:** The system strictly permits exactly **ONE** administrator account. Attempting a second bootstrap aborts with `ALREADY_EXISTS`.
- **Zero Default Account on Startup:** No hardcoded admin credentials or default accounts are created automatically upon boot.
- **Secure Secret Acquisition:**
  - In interactive TTY mode: prompts for password using hidden terminal input (characters not echoed to screen).
  - In automated installer mode: supports `ADMIN_BOOTSTRAP_PASSWORD` environment variable (immediately deleted from memory after reading).
  - Passwords are **never** accepted via command-line arguments to prevent leakage in shell history or `ps aux`.

### 2.2 Password Security & Hashing
- **Algorithm:** **Argon2id** (OWASP recommended standard for password hashing) via `@node-rs/argon2`.
- **Parameters:** 19 MiB (`memoryCost: 19456`), 2 iterations (`timeCost: 2`), parallelism 1.
- **Input Validation:** Minimum 10 characters, maximum 128 characters. Username requires 3-32 alphanumeric/underscore characters.
- **Exposure Prevention:** Password hashes and salts are never returned in any API responses.

### 2.3 Server-Side Session Management
- **Persistence:** Sessions are persisted directly to the PostgreSQL `sessions` table via `PrismaSessionStore`, ensuring server restarts do not silently drop active administrative sessions.
- **Cookie Security:**
  - `name`: `it_asset_sess`
  - `httpOnly: true` (prevents client-side JavaScript access)
  - `sameSite: 'lax'` (prevents cross-site cookie leakage)
  - `secure`: Enabled automatically in production (`COOKIE_SECURE=true` or `NODE_ENV=production`)
  - `maxAge`: 8 hours (`8 * 60 * 60 * 1000`)
- **Session Fixation Prevention:** Calls `req.session.regenerate()` immediately upon successful login.

### 2.4 CSRF & Abuse Protection
- **CSRF Defense:**
  - Origin/Referer header verification against request host.
  - Cryptographically secure 256-bit CSRF tokens issued per session (`GET /api/auth/csrf`).
  - State-changing requests (`POST`, `PUT`, `DELETE`, `PATCH`) validate `x-csrf-token` header against the session.
- **Brute-Force & Abuse Mitigation:**
  - IP-based sliding-window rate limiter on `/api/auth/login` (max 10 requests per minute).
  - Account lockout stored in PostgreSQL: after 5 consecutive failed login attempts, the account is locked for 15 minutes (`locked_until`).
- **Registration Denial:** `POST /api/auth/register` explicitly responds with `404 Not Found`.

---

## 3. Environment Configuration & PostgreSQL Setup

### 3.1 Configuration File (`.env`)
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key environment variables:
```ini
# PostgreSQL connection string
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/it_asset_management?schema=public"

# Session Security (Required in production, minimum 32 characters)
SESSION_SECRET="change-this-to-a-secure-random-32-character-secret-in-production"

# Cookie Security (true behind HTTPS, false on local HTTP development)
COOKIE_SECURE="false"

# Server Network Configuration (127.0.0.1 default loopback)
PORT=3000
HOST="127.0.0.1"
NODE_ENV="development"
```

### 3.2 Administrator Bootstrap Command
Run the interactive provisioning CLI:

```bash
npm run admin:bootstrap
```

Or non-interactively via installer environment variable:
```bash
ADMIN_BOOTSTRAP_USERNAME="admin" ADMIN_BOOTSTRAP_PASSWORD="MySecurePassword123!" npm run admin:bootstrap
```

---

## 4. Verification & Test Suite

Run the full automated test suite (24 tests across 5 test suites):

```bash
npm run test
```

### Automated Check Suites:
1. `test/auth-password.test.ts`: Argon2id hash formatting, candidate verification, username and password strength validation.
2. `test/auth-bootstrap.test.ts`: Password strength enforcement, username validation, single-admin duplicate rejection.
3. `test/auth-endpoints.test.ts`: Health check preservation, registration blockage (404), `/api/auth/me` protection (401), CSRF generation, login input validation, logout cookie clearing, CSRF origin blockage, and account lockout calculation.
4. `test/database-schema.test.ts`: All P02 PostgreSQL constraints, models, relations, check constraints, and indexes.
5. `test/health.test.ts`: Backend diagnostic health check and server configuration defaults.

---

## 5. Scope Boundaries & Next Phase Handoff

### Strictly Excluded in Phase P03
- **No UI/UX:** No Login form, Dashboard, Sidebar, or frontend authentication views (P05).
- **No Multi-User / RBAC:** Exactly one administrator account supported; no roles or permissions system.
- **No Public Registration:** No signup routes, password reset flows, or self-service features.
- **No Asset CRUD:** Asset operations deferred to Phase P04.

### Handoff to Phase P04 (Asset Data Operations & Business Logic)
- Reusable `requireAdmin` middleware ready to protect all non-public asset management API routes.
- Fully initialized and secured authentication layer with persistent PostgreSQL sessions.


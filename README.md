# IT Asset Management System — Phase P04 (Core Asset API & Transactional Audit)

A production-oriented full-stack IT Asset Management Web Application, designed for independent local deployment on Ubuntu Linux (including WSL2 and private VMs) and developed in Google AI Studio.

---

## 1. Architecture Overview (Modular Monolith)

This repository implements **Phase P04 — Core Asset API & Transactional Audit** on top of the Phase P01 foundation, Phase P02 PostgreSQL data architecture, and Phase P03 single-administrator authentication. It establishes secure, authenticated Asset creation, retrieval, and controlled general patching with atomic PostgreSQL audit events without introducing premature UI screens or unapproved business workflows.

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
├── README.md                 # Project, database, authentication & API documentation (this file)
│
├── prisma/                   # PostgreSQL schema & versioned migrations (Prisma ORM)
│   ├── schema.prisma         # Declarative PostgreSQL data model (including Assets and AssetAuditEvents)
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
│   │   ├── assets.ts         # Asset endpoints (POST, GET /:id, PATCH /:id, GET /:id/history)
│   │   ├── auth.ts           # Auth endpoints (/api/auth/login, /logout, /me, /csrf, /register)
│   │   ├── health.ts         # Diagnostic GET /health endpoint
│   │   └── lookups.ts        # Reference lookup endpoints (/asset-types, /locations, /device-health, /people)
│   ├── scripts/
│   │   └── bootstrapAdmin.ts # Interactive CLI command for initial administrator provisioning
│   ├── services/
│   │   ├── assetService.ts   # Asset CRUD logic & atomic transactional audit event logging
│   │   └── lookupService.ts  # Read-only lookups and explicit Person creation service
│   ├── types/
│   │   └── session.d.ts      # TypeScript augmentation for express-session and request context
│   └── validators/
│       └── assetValidators.ts # Strict input validation for Asset Create and Patch operations
│
├── src/                      # Frontend application (React 19 + TypeScript)
│   ├── App.tsx               # Minimal neutral application bootstrap
│   ├── index.css             # Base stylesheet reset
│   └── main.tsx              # React DOM root bootstrapping
│
└── test/                     # Test suites (node:test + node:assert)
    ├── asset-audit-service.test.ts # Error mapping, conflict detail & transactional audit tests
    ├── asset-endpoints.test.ts # Route authentication & method prohibition tests (401, 405)
    ├── asset-validation.test.ts # Asset input validation & forbidden field rejection tests
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

## 3. Core Asset APIs & Transactional Audit (Phase P04)

All asset operations are strictly authenticated behind `requireAdmin` and protected against CSRF attacks.

### 3.1 Endpoint Contracts

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/assets` | Creates an asset and atomically creates `AssetAuditEvent` | Yes (`requireAdmin` + CSRF) |
| `GET` | `/api/assets/:id` | Returns single asset with relations (`type`, `location`, `health`, `owner`, `user`) | Yes (`requireAdmin`) |
| `PATCH` | `/api/assets/:id` | Safely updates general fields and atomically creates `AssetAuditEvent` | Yes (`requireAdmin` + CSRF) |
| `GET` | `/api/assets/:id/history` | Returns chronological audit log for the asset with pagination (`?page=1&limit=50`) | Yes (`requireAdmin`) |
| `DELETE`| `/api/assets/:id` | **405 Method Not Allowed** (Deletion is prohibited) | Yes |
| `GET` | `/api/lookups/asset-types`| Active asset classification types | Yes (`requireAdmin`) |
| `GET` | `/api/lookups/locations`| Active physical company locations | Yes (`requireAdmin`) |
| `GET` | `/api/lookups/device-health`| Active device operational health statuses | Yes (`requireAdmin`) |
| `GET` | `/api/people` | Search/lookup people records (`?search=&limit=50`) | Yes (`requireAdmin`) |
| `POST` | `/api/people` | Minimal person creation with explicit ID; no name-based merging | Yes (`requireAdmin` + CSRF) |

### 3.2 Transactional Audit History Guarantees
- **Atomic Persistence:** Each asset creation (`CREATE`) or general modification (`UPDATE`) executes within a single `prisma.$transaction`. An `AssetAuditEvent` is persisted in the exact same database transaction.
- **Accurate Snapshots:** Captures `operationId`, `actor` (derived strictly from server session, never from client body), `changedFields` (array of changed attributes), `beforeValues` (pre-mutation state), and `afterValues` (post-mutation state).
- **No-Op Prevention:** If a `PATCH` request provides values identical to the current record, no database write is performed and **NO audit event is created**.
- **Rollback Safety:** If any constraint fails (e.g. duplicate Asset Number), the entire transaction aborts without creating orphan audit events.

### 3.3 Safety Boundaries & Reserved Fields
- **Immutable Asset ID:** Client-provided `id` is rejected on creation and patch.
- **Independent Optional Identifiers:** `assetNumber` and `serialNumber` are independently optional; missing values are stored as database `NULL`, never fabricated strings. Duplicate non-null values return a descriptive **409 Conflict**.
- **Reserved Transfer & Assignment Fields (Phase P10):** Direct modification of `acOwnerId`, `currentUserId`, `department`, `costCenter`, `legacyNewCostCenter`, and `eformNumber` via general asset PATCH is rejected with **400 Bad Request**.
- **Reserved Physical Verification Fields (Phase P11):** Direct modification of `lastVerifiedAt`, `lastVerifiedYearMonth`, and `lastVerificationOutcome` via general asset PATCH is rejected with **400 Bad Request**.

---

## 4. Environment Configuration & PostgreSQL Setup

### 4.1 Configuration File (`.env`)
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

### 4.2 Administrator Bootstrap Command
Run the interactive provisioning CLI:

```bash
npm run admin:bootstrap
```

Or non-interactively via installer environment variable:
```bash
ADMIN_BOOTSTRAP_USERNAME="admin" ADMIN_BOOTSTRAP_PASSWORD="MySecurePassword123!" npm run admin:bootstrap
```

---

## 5. Verification & Test Suite

Run the full automated test suite (44 tests across 8 test suites):

```bash
npm run test
```

### Automated Check Suites:
1. `test/asset-validation.test.ts`: Create and Patch input validation, RFC 4122 UUID verification, forbidden field rejection (P10/P11), immutable ID protection, empty identifier NULL normalization.
2. `test/asset-endpoints.test.ts`: Route authentication (401), DELETE method rejection (405), unauthenticated lookup blockage, health check preservation.
3. `test/asset-audit-service.test.ts`: Error classes (`DuplicateIdentifierError`, `AssetNotFoundError`), transactional audit rollback logic, integration checks.
4. `test/auth-password.test.ts`: Argon2id hash formatting, candidate verification, username and password strength validation.
5. `test/auth-bootstrap.test.ts`: Password strength enforcement, username validation, single-admin duplicate rejection.
6. `test/auth-endpoints.test.ts`: Health check preservation, registration blockage (404), `/api/auth/me` protection (401), CSRF generation, login input validation, logout cookie clearing, CSRF origin blockage, and account lockout calculation.
7. `test/database-schema.test.ts`: All P02 PostgreSQL constraints, models, relations, check constraints, and indexes.
8. `test/health.test.ts`: Backend diagnostic health check and server configuration defaults.

---

## 6. Scope Boundaries & Next Phase Handoff

### Strictly Excluded in Phase P04
- **No UI/UX:** No Asset Grid, New Asset form, Modal, Sidebar, or Design System (P05–P09).
- **No Transfer / eForm Workflow:** Ownership and assignment workflows deferred to Phase P10.
- **No Physical Verification Workflow:** Verification logic and outcome history deferred to Phase P11.
- **No Delete or Bulk Updates:** Asset deletion and mass updates are prohibited.
- **No Advanced Grid Search/Filtering:** Advanced server-side search and filters deferred to Phase P08.

### Handoff to Phase P05 (Design System) & Phase P06 (New Asset UI)
- Fully functional, authenticated REST endpoints (`POST /api/assets`, `GET /api/assets/:id`, `PATCH /api/assets/:id`, `GET /api/assets/:id/history`) ready for frontend consumption.
- Reference lookup endpoints (`/api/lookups/*` and `/api/people`) ready for form dropdowns and autocomplete.
- Robust transactional audit logging operating transparently in the background.

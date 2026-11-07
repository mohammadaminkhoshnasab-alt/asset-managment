# IT Asset Management System — Phase P02 (PostgreSQL Data Architecture)

A production-oriented full-stack IT Asset Management Web Application, designed for independent local deployment on Ubuntu Linux (including WSL2 and private VMs) and developed in Google AI Studio.

---

## 1. Architecture Overview (Modular Monolith)

This repository implements **Phase P02 — PostgreSQL Data Architecture** on top of the Phase P01 foundation. It establishes the normalized relational database models, versioned migration scripts, and integrity constraints for the IT Asset Management domain without introducing premature business APIs or UI screens.

### Directory Structure

```
├── .env.example              # Non-secret environment variable template (including DATABASE_URL)
├── .gitignore                # Source control exclusions
├── index.html                # HTML entry point (title, meta, root mount)
├── metadata.json             # AI Studio applet metadata
├── package.json              # Project manifest, dependencies, and lifecycle scripts
├── package-lock.json         # Deterministic npm dependency lockfile
├── tsconfig.json             # TypeScript compiler configuration (client, server, test)
├── vite.config.ts            # Vite client bundler and plugin configuration
├── server.ts                 # Full-stack entry point (dev middleware / prod static)
├── README.md                 # Project and data architecture documentation (this file)
│
├── prisma/                   # PostgreSQL schema & versioned migrations (Prisma ORM)
│   ├── schema.prisma         # Declarative PostgreSQL data model
│   └── migrations/
│       └── 20261107000000_init_postgresql_schema/
│           └── migration.sql # Versioned initial SQL migration with constraints & indexes
│
├── server/                   # Backend application (Node.js + Express + TypeScript)
│   ├── app.ts                # Express application factory, routing & error middleware
│   ├── config/
│   │   └── environment.ts    # Typed environment configuration loader (PORT, HOST, NODE_ENV)
│   ├── db/
│   │   └── client.ts         # PrismaClient database connection singleton
│   ├── middleware/
│   │   └── errorHandler.ts   # Centralized error handling middleware
│   └── routes/
│       └── health.ts         # Diagnostic GET /health endpoint
│
├── src/                      # Frontend application (React 19 + TypeScript)
│   ├── App.tsx               # Minimal neutral application bootstrap
│   ├── index.css             # Base stylesheet reset
│   └── main.tsx              # React DOM root bootstrapping
│
└── test/                     # Test suites (node:test + node:assert)
    ├── database-schema.test.ts # Schema integrity, constraints & relationship tests
    └── health.test.ts        # Health check and environment configuration tests
```

---

## 2. ORM & Tooling Choice: Prisma ORM (v6.19)

**Prisma ORM** was selected as the PostgreSQL data access and migration solution for the following architectural reasons:
1. **Type Safety & Schema Centralization:** `prisma/schema.prisma` provides a single declarative source of truth for all models, relations, and enums, compiling to type-safe TypeScript models for server services.
2. **Versioned SQL Migrations:** Generates standard, readable PostgreSQL SQL migration scripts stored in `prisma/migrations/`, ensuring transparent database evolution.
3. **Safe Production Migrations:** The `npx prisma migrate deploy` command applies pending migrations transactionally without resetting or truncating existing data.
4. **Standalone Portability:** Operates natively on Ubuntu Linux, WSL2, or Docker containers without proprietary cloud dependencies.

---

## 3. Data Model & Relational Concepts

The schema is normalized to 3NF, enforcing referential integrity while accurately modeling real-world operational IT asset tracking:

### 3.1 Assets (`assets`)
- **Primary Key:** `id` (UUID), immutable internal identifier.
- **Identifiers:** `asset_number` and `serial_number` are independently unique when non-NULL (`CREATE UNIQUE INDEX`). Multiple assets with NULL identifiers are permitted.
- **Classification:** Relates to extensible `AssetType`, `Location`, and `DeviceHealth` lookup tables.
- **Ownership vs. Actual User:**
  - `ac_owner_id` (foreign key to `people`): AC Owner (the officially responsible person).
  - `current_user_id` (foreign key to `people`): Current user (the actual person operating the device).
- **Legacy Migration Field:** `legacy_new_cost_center` (nullable) preserves legacy "New CC" data during Excel migration without enforcing it as a permanent mandatory field.
- **Status:** Enum `AssetStatus` (`IN_USE`, `SPARE`, `DISPOSED`, `UNKNOWN`).

### 3.2 People & Identities (`people`)
- **Distinct Identity Modeling:** Separates official identity from operational usernames:
  - `personal_code` (unique, nullable): Employee/staff code associated with AC Owner.
  - `username` (unique, nullable): System/network username associated with current user.
- **No False Merging:** Individuals are tracked by unique IDs, preventing incorrect merging based on matching names.

### 3.3 Assignments & Transfers (`asset_transfers`)
- **eForm Repeatability:** `eform_number` is indexed but **non-unique**, allowing one eForm (e.g. transfer form) to associate across multiple transferred assets.
- **Status Lifecycle:** `TransferStatus` (`PENDING`, `COMPLETED`, `CANCELLED`). Defaults to `PENDING`.
- **Constraint:** Database-level check constraint `chk_transfer_completed_eform` enforces that a transfer with status `COMPLETED` must have a non-empty `eform_number`.

### 3.4 Append-Only Audit Trail (`asset_audit_events`)
- **Immutable Audit Log:** Captures `actor`, `source` (`UI`, `EXCEL_MIGRATION`, `SYSTEM`, `API`), `timestamp`, `action`, `changed_fields` (JSON), `before_values` (JSON), and `after_values` (JSON).
- **Batch Grouping:** `operation_id` (UUID) groups multiple field or entity changes performed within the same atomic transaction.
- **Cascade Protection:** Foreign key references use `ON DELETE RESTRICT`, preventing accidental cascade deletion of historical records if an asset is deleted.

### 3.5 Physical Verification (`physical_verifications`)
- **Date Precision Model:** Accurately distinguishes day-precision dates from month-only dates (common in legacy inventory audits):
  - `date_precision` (`DAY` or `MONTH`).
  - `verified_year` (INTEGER) and `verified_month` (INTEGER, 1-12).
  - `verified_day` (INTEGER, nullable: must be non-NULL for `DAY` precision, and NULL for `MONTH` precision).
  - Enforced at PostgreSQL level by check constraint `chk_verification_date_precision`.
- **Outcome:** Enum `VerificationOutcome` (`VERIFIED_MATCH`, `LOCATION_MISMATCH`, `USER_MISMATCH`, `STATUS_MISMATCH`, `NOT_FOUND`, `DAMAGED`).

### 3.6 Follow-ups (`asset_follow_ups`)
- Tracks ongoing lifecycle actions, discrepancies, and resolutions with `status` (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CANCELLED`), `priority`, `resolution_notes`, and `resolved_at`.
- Check constraint `chk_followup_resolved_timestamp` requires `resolved_at` when status is `RESOLVED`.

### 3.7 Admin Credentials & Settings (`admin_credentials`, `app_settings`)
- Stores configuration key-value pairs and administrator credential schema (`username`, `password_hash`, `salt`, `failed_attempts`, `locked_until`). *Authentication logic is deferred to future phases.*

---

## 4. Environment Configuration & PostgreSQL Setup

### 4.1 Configuration File (`.env`)
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set `DATABASE_URL` with your local PostgreSQL credentials:

```ini
# PostgreSQL connection string:
DATABASE_URL="postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>?schema=public"

# Example for local Ubuntu/WSL2 deployment:
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/it_asset_management?schema=public"
```

### 4.2 Migration Commands

All database lifecycle scripts use standard npm commands:

```bash
# Validate Prisma schema against syntax rules
npm run db:validate

# Generate Prisma Client TypeScript definitions
npm run db:generate

# Apply pending versioned migrations in production/standalone (safe; never resets existing data)
npm run db:migrate

# Apply migrations in local development with migration tracking
npx prisma migrate dev
```

---

## 5. Verification & Test Suite

Run all tests via Node's native test runner:

```bash
npm run test
```

### Automated Checks:
1. `test/database-schema.test.ts`:
   - Validates all 11 models and 7 enums in `schema.prisma`.
   - Validates unique non-NULL constraints on Asset Number and Serial Number.
   - Validates separate AC Owner and Current User relations.
   - Validates non-unique `eform_number` index and repeatability.
   - Validates date precision modeling (`DAY` vs `MONTH`).
   - Validates `ON DELETE RESTRICT` cascade protections on audit and history tables.
   - Validates check constraints (`chk_transfer_completed_eform`, `chk_verification_date_precision`, `chk_followup_resolved_timestamp`).
2. `test/health.test.ts`:
   - Validates backend health endpoint and environment configuration.

---

## 6. Scope Boundaries & Next Phase Handoff

### Strictly Excluded in Phase P02
- **No UI/UX:** No Asset Grid, forms, screens, or dashboard.
- **No Business APIs:** No asset CRUD endpoints, transfer workflows, or verification routes.
- **No Authentication:** Schema only; no login endpoints or session tokens.
- **No Excel Importer:** Migration scripts and schema only; no Excel ingestion scripts.

### Handoff to Phase P03
- Complete, type-safe database layer ready for service-layer CRUD, transaction handlers, and repository patterns in subsequent phases.

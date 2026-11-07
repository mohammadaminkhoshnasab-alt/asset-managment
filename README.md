# IT Asset Management System — Phase P06 (New Asset Registration)

A production-oriented full-stack IT Asset Management Web Application, designed for independent local deployment on Ubuntu Linux (including WSL2 and private VMs) and developed in Google AI Studio.

---

## 1. Architecture Overview (Modular Monolith)

This repository implements **Phase P06 — New Asset Registration** on top of the Phase P01 foundation, Phase P02 PostgreSQL data architecture, Phase P03 single-administrator authentication, Phase P04 Core Asset APIs, and Phase P05 Design System & Application Shell. It delivers a polished, responsive hardware asset registration interface at `/assets/new`, integrated with the authenticated `POST /api/assets` endpoint and CSRF protection, while maintaining deferred roadmap boundaries for all other workspaces.

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
├── src/                      # Frontend application (React 19 + TypeScript + Tailwind v4)
│   ├── App.tsx               # Session-aware root component (Auth provider, Login vs AppShell)
│   ├── index.css             # Tailwind v4 configuration, industrial color palette & custom scrollbars
│   ├── main.tsx              # React DOM root bootstrapping
│   ├── components/           # Component library & application shell
│   │   ├── assets/           # (P06) Hardware asset management workspaces
│   │   │   ├── CreatePersonModal.tsx # Minimal explicit Person creation helper
│   │   │   └── NewAssetView.tsx      # Polished, responsive New Asset registration form
│   │   ├── auth/
│   │   │   └── LoginView.tsx # Industrial dark login card with real auth integration & preview toggle
│   │   ├── shell/
│   │   │   ├── AppShell.tsx  # Responsive desktop & mobile application frame
│   │   │   ├── Header.tsx    # Telemetry bar, system status, clock, operator identity & logout
│   │   │   └── Sidebar.tsx   # 6 approved navigation items, active amber badge & operator profile
│   │   └── ui/
│   │       ├── Button.tsx    # Industrial button with variants (primary, secondary, outline, ghost, danger)
│   │       ├── Input.tsx     # Form input with icon slots, validation states & mono styling
│   │       ├── LoadingState.tsx # Industrial spinner and state loader
│   │       ├── Panel.tsx     # Charcoal surface card with header tags & action slots
│   │       ├── RoutePlaceholder.tsx # Strict phase-boundary placeholder with roadmap metadata
│   │       └── StatusBadge.tsx # Semantic lifecycle indicators (In Use, Spare, Needs Attention, Disposed)
│   ├── context/
│   │   └── AuthContext.tsx   # React context for /api/auth/me, /login, /logout & preview inspection
│   ├── types/
│   │   ├── asset.ts          # (P06) Asset, lookups (DeviceHealth.name), form state contracts
│   │   ├── auth.ts           # AdminUser, AuthStatus, AuthContext contracts
│   │   └── navigation.ts     # Exactly 6 approved navigation routes & metadata
│   └── utils/
│       ├── assetFormValidation.ts # (P06) Form validation and NULL-normalization payload builder
│       └── lookupClient.ts        # (P06) Granular reference catalog loader and partial-failure handling
│
└── test/                     # Test suites (node:test + node:assert)
    ├── asset-audit-service.test.ts # Error mapping, conflict detail & transactional audit tests
    ├── asset-endpoints.test.ts # Route authentication & method prohibition tests (401, 405)
    ├── asset-form-validation.test.ts # (P06) Client form validation & payload building tests
    ├── asset-validation.test.ts # Asset input validation & forbidden field rejection tests
    ├── auth-bootstrap.test.ts # Single-admin bootstrap and idempotency tests
    ├── auth-endpoints.test.ts # Login, logout, me, CSRF, and registration denial tests
    ├── auth-password.test.ts  # Argon2id hashing, verification, and input validation tests
    ├── database-schema.test.ts # Schema integrity, constraints & relationship tests
    ├── design-system-navigation.test.ts # Navigation contract, 6 approved routes & screenshot filter tests
    ├── health.test.ts         # Health check and environment configuration tests
    └── lookup-client.test.ts  # (P06) Lookup catalogs, partial failure & DeviceHealth.name tests
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

---

## 4. Design System & Application Shell (Phase P05)

### 4.1 Visual Language & Aesthetic Tokens
The frontend architecture implements a Modern Industrial Dark Design System inspired by enterprise air-gapped hardware consoles:
- **Surface Palette:**
  - Workspace Base: `#0a0c10` (deep charcoal background)
  - Card & Panel Surface: `#11141c` (elevated container background)
  - Secondary Elevated Surface: `#181d28` (input controls, active headers)
  - Border Accents: `#1f2633` (crisp, subtle structural division)
- **Signature Accent:**
  - Primary Amber: `#ea8c34` (industrial warning/action amber, warm metallic feel)
  - Amber Hover: `#d97d26`
  - Active Tab/Nav Badge: Solid amber fill (`#ea8c34`) with dark contrasting typography (`#020617` / `text-slate-950`)
- **Typography & Proportions:**
  - Clean monospace headers for telemetry (`font-mono`, `//// IT ASSET MANAGEMENT SYSTEM //`)
  - Crisp sans-serif body typography with high contrast readability
  - Information-dense layouts with clear visual hierarchy, subtle borders, and no pill-shaped decorative bloat

### 4.2 Approved Navigation Items (Strict 6-Route Contract)
The application shell enforces exactly the six approved navigation routes:
1. **Dashboard** (`/`) — Target Phase: P14 (Executive Dashboard & Metric Telemetry)
2. **All Assets** (`/assets`) — Target Phase: P08 (Full Asset Inventory Registry & Search)
3. **New Asset** (`/assets/new`) — Target Phase: P06 (Asset Creation Workflow & Form)
4. **Import Assets** (`/import`) — Target Phase: P12 (Excel/CSV Batch Importer)
5. **Needs Attention** (`/attention`) — Target Phase: P09 (Audit & Physical Verification Flags)
6. **Settings & Backup** (`/settings`) — Target Phase: P15 (System Settings & JSON Backup/Restore)

*Note on Visual Reference Screenshots:* The attached reference mockups displayed hypothetical tabs ("Employees", "Reports", "User Management"). As strictly mandated by Phase P05 specifications, those features are filtered out and rejected from the navigation system.

### 4.3 Reusable Component Foundation
- **`Button`:** Standardized variants (`primary` amber, `secondary`, `outline`, `ghost`, `danger`), sizes (`sm`, `md`, `lg`), with accessible loading spinners and disabled states.
- **`Input`:** Charcoal form field with optional left/right iconography, monospace numeric formatting, explicit helper text, and high-visibility focus borders.
- **`Panel`:** Structured card container featuring industrial tag banners, header actions, and consistent padding.
- **`StatusBadge`:** Semantic lifecycle indicators:
  - `IN_USE`: Emerald green (`#10b981`)
  - `SPARE`: Sky blue (`#0284c7`)
  - `NEEDS_ATTENTION`: Amber (`#ea8c34`)
  - `DISPOSED`: Rose red (`#f43f5e`)
- **`LoadingState`:** Hardware telemetry animation with pulsing indicators.
- **`RoutePlaceholder`:** Clean, non-functional boundary placeholder communicating technical roadmap status and preventing unapproved mock data generation.

### 4.4 Authentication & Session Integration
- **Direct Backend Hook:** Connected directly to Phase P03 endpoints:
  - `GET /api/auth/me`: Detects active session on initial page load.
  - `GET /api/auth/csrf`: Retrieves cryptographically signed session CSRF tokens.
  - `POST /api/auth/login`: Real username/password authentication with lockout warning support.
  - `POST /api/auth/logout`: Clears backend session and resets client state.
- **Preview Inspection Mode:** In standalone preview environments where local PostgreSQL is offline, developers can toggle "Preview Inspection Mode" to audit the application shell and design tokens.

---

## 5. New Asset Registration Interface (Phase P06)

### 5.1 Registration Form Architecture (`/assets/new`)
Phase P06 replaces the previous `new-asset` route placeholder with a complete, responsive asset registration interface built inside `AppShell` using the Modern Industrial Dark design tokens. Fields are organized into four cohesive functional sections:

1. **Hardware Identification (Core Identifiers):**
   - **`model` (Required):** Non-empty hardware equipment specification or manufacturer model name.
   - **`assetNumber` (Optional):** Internal accounting tag. Completely independent from the Serial Number. Empty values are sent as `null` (never synthesized placeholders such as `"N/A"`).
   - **`serialNumber` (Optional):** Manufacturer Serial Number (SN). Completely independent from Asset Number. Empty values are sent as `null`.
2. **Classification & Condition:**
   - **`typeId` (Optional):** Foreign-key UUID selected from `GET /api/lookups/asset-types`.
   - **`status` (Required, default `SPARE`):** Validated against `VALID_ASSET_STATUSES` (`SPARE`, `IN_USE`, `DISPOSED`, `UNKNOWN`) with real-time semantic status badges.
   - **`locationId` (Optional):** Foreign-key UUID selected from `GET /api/lookups/locations`.
   - **`deviceHealthId` (Optional):** Foreign-key UUID selected from `GET /api/lookups/device-health`. Aligned with the backend `DeviceHealth.name` property.
3. **Initial Assignment & Organization:**
   - **`acOwnerId` (Optional):** Officially responsible custodian selected from `GET /api/people`. When selected, the person's `personalCode` is displayed as associated metadata (never confused with system username or used as an independent asset identifier).
   - **`currentUserId` (Optional):** Actual system operator selected from `GET /api/people`. Selection is independent of `acOwnerId`.
   - **`department` & `costCenter` (Optional):** Text allocations established at initial registration.
   - **Explicit Person Creation Helper (`CreatePersonModal`):** If a person is not present in the directory, an explicit modal sends `POST /api/people` to register them. The UI explicitly discloses that the Person record is an independent save and will not be automatically rolled back if asset registration is cancelled or fails.
4. **Operational Notes & Metadata:**
   - **`label` (Optional):** Descriptive tag for listings.
   - **`comment` (Optional):** Internal audit remarks preserved in the initial audit log.
   - **Routine Exclusion:** `legacyNewCostCenter` is strictly excluded from manual registration (belongs to future batch import workflows). Internal UUIDs, audit actors, verification records, eForms, and transfer fields are never exposed for manual client entry.

### 5.2 API Submission & Safety Contracts
- **Endpoint:** Authenticated `POST /api/assets` with `credentials: 'include'`.
- **CSRF Guard:** Required `x-csrf-token` header retrieved from session context.
- **Client Validation & Normalization:** `src/utils/assetFormValidation.ts` enforces required non-empty model and converts empty string inputs to `null`.
- **Success Criteria:** The UI reports success **only** after receiving a real `HTTP 201 Created` response with the server-assigned UUID and persisted record. It displays a copyable UUID card and actions to register another asset or return to the dashboard.
- **Error Handling & State Retention:**
  - `400 Bad Request`: Field-specific or general validation error displayed without clearing typed input.
  - `401 Unauthorized`: Notifies the user of session expiration without losing entered data.
  - `403 Forbidden`: CSRF token error notice with re-fetch opportunity.
  - `409 Conflict`: Identifies duplicate Asset Number or Serial Number collisions on the exact conflicting field.
  - `5xx / Network Interruption`: Alerts the user that persistence is unverified if the connection dropped while in flight, advising checking the registry before re-submitting to prevent accidental duplicate entries.

### 5.3 Granular Reference Catalog Loading (`src/utils/lookupClient.ts`)
- **Truthful Error Reporting:** When lookup endpoints return HTTP 401 or 403, the system reports authentication or CSRF requirements specifically, rather than incorrectly claiming PostgreSQL is offline.
- **Partial Failure Isolation:** If one or more of the 4 lookup requests fail (e.g. timeout on locations), successfully loaded catalogs are retained in memory while the user is shown a specific retry option (`Retry Catalogs`).
- **Device Health Alignment:** Frontend contracts map `DeviceHealth.name` directly matching the Prisma data model.

### 5.4 Operational Boundaries & Known Limitations
- **Preview Inspection Mode Restriction:** In Preview Mode, the New Asset form can be visually audited and client validation can be exercised, but the primary Save action is strictly disabled (`disabled` state, visibly labeled "Save Disabled (Preview Mode)"). No fake records or simulated persistence are created.
- **PostgreSQL Connection Prerequisite:** Real asset creation requires an active, provisioned PostgreSQL database and authenticated administrator session. In local/preview environments where PostgreSQL is not yet provisioned, live database integration tests are recorded as **NOT VERIFIED**. Comprehensive end-to-end integration QA across all workflows is scheduled for Phase P18.

---

## 6. Verification & Test Suite

Run the full automated test suite (57 tests across 11 test suites):

```bash
npm run test
```

### Automated Check Suites:
1. `test/lookup-client.test.ts`: **(P06)** Verifies `DeviceHealth.name` mapping, complete success, partial catalog failure isolation, pre-existing state retention, and truthful 401/403 status distinction.
2. `test/asset-form-validation.test.ts`: **(P06)** Verifies model requirement, optional UUID formatting, empty string to NULL normalization (no "N/A" synthesis), and distinct AC Owner vs Current User preservation.
3. `test/design-system-navigation.test.ts`: **(P05)** Verifies exactly the 6 approved navigation items, path bindings, and rejection of unapproved screenshot-only navigation items.
4. `test/asset-validation.test.ts`: **(P04)** Create and Patch input validation, RFC 4122 UUID verification, forbidden field rejection (P10/P11), immutable ID protection, empty identifier NULL normalization.
5. `test/asset-endpoints.test.ts`: **(P04)** Route authentication (401), DELETE method rejection (405), unauthenticated lookup blockage, health check preservation.
6. `test/asset-audit-service.test.ts`: **(P04)** Error classes (`DuplicateIdentifierError`, `AssetNotFoundError`), transactional audit rollback logic, integration checks.
7. `test/auth-password.test.ts`: **(P03)** Argon2id hash formatting, candidate verification, username and password strength validation.
8. `test/auth-bootstrap.test.ts`: **(P03)** Password strength enforcement, username validation, single-admin duplicate rejection.
9. `test/auth-endpoints.test.ts`: **(P03)** Health check preservation, registration blockage (404), `/api/auth/me` protection (401), CSRF generation, login input validation, logout cookie clearing, CSRF origin blockage, and account lockout calculation.
10. `test/database-schema.test.ts`: **(P02)** All P02 PostgreSQL constraints, models, relations, check constraints, and indexes.
11. `test/health.test.ts`: **(P01)** Backend diagnostic health check and server configuration defaults.

---

## 7. Scope Boundaries & Next Phase Handoff

### Strictly Excluded in Phase P06
- **No Later-Phase Modules:** All Assets table/grid (P07 & P08), asset details/editing (P08), transfer workflows & eForms (P10), physical verification audits (P11), Excel batch importer (P12), needs attention discrepancy resolution (P13), executive metrics (P14), system settings & backup (P15).
- **No Schema Changes or Migrations:** Zero modifications to Prisma models, migrations, or database tables.
- **No Simulated Client Storage:** No fake persistence in `localStorage` or memory stubs pretending to be database saves.

### Handoff to Phase P07 (All Assets View)
- Working `/assets/new` asset registration page with server-validated payload generation.
- Reusable lookup client utility with granular error isolation and `DeviceHealth.name` contract alignment.
- Six approved navigation items in `AppShell` ready to receive the All Assets grid in Phase P07.

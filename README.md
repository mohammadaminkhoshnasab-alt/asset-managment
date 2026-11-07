# IT Asset Management System — Phase P01 (Project Foundation)

A production-oriented IT Asset Management Web Application foundation designed for local standalone deployment on Ubuntu Linux (including WSL2 and private VMs) and development in Google AI Studio.

---

## 1. Architecture Overview (Modular Monolith)

This repository implements **Phase P01 — Project Foundation**. It establishes a full-stack Modular Monolith architecture separating the client-side single-page application and the server-side API application while supporting unified development and standalone production execution.

### Directory Structure

```
├── .env.example              # Non-secret environment variable template
├── .gitignore                # Source control exclusions
├── index.html                # HTML entry point (title, meta, root mount)
├── metadata.json             # AI Studio applet configuration and capabilities
├── package.json              # Project manifests, dependencies, and lifecycle scripts
├── tsconfig.json             # TypeScript compiler configuration
├── vite.config.ts            # Vite client bundler and plugin configuration
├── server.ts                 # Full-stack runtime entry point (dev middleware / prod static)
├── README.md                 # Foundation documentation (this file)
│
├── server/                   # Backend application (Node.js + Express + TypeScript)
│   ├── app.ts                # Express application factory, routing & middleware assembly
│   ├── config/
│   │   └── environment.ts    # Typed environment configuration loader with safe defaults
│   ├── middleware/
│   │   └── errorHandler.ts   # Centralized error handling middleware
│   └── routes/
│       └── health.ts         # Diagnostic GET /health endpoint
│
├── src/                      # Frontend application (React 19 + TypeScript)
│   ├── App.tsx               # Minimal neutral application scaffold
│   ├── index.css             # Tailwind CSS entry point
│   └── main.tsx              # React DOM root bootstrapping
│
└── test/                     # Foundation unit tests (node:test + node:assert)
    └── health.test.ts        # Health check and environment configuration tests
```

---

## 2. Core Frameworks & Tooling

- **Frontend Runtime:** React 19 (`react: ^19.0.1`, `react-dom: ^19.0.1`)
- **Backend Runtime:** Node.js v22+ with Express (`express: ^4.21.2`, `@types/express: ^4.17.21`)
- **Language & Type System:** TypeScript (`typescript: ^7.0.2`, `@types/node: ^22.14.0`)
- **Bundler & Client Dev Server:** Vite 8 (`vite: ^8.3.0`, `@vitejs/plugin-react: ^6.1.1`)
- **Server Bundler:** esbuild (`esbuild: ^0.25.0`)
- **TypeScript Dev Execution:** tsx (`tsx: ^4.21.0`)
- **Styling Pipeline:** Tailwind CSS v4 (`@tailwindcss/vite: ^4.3.3`, `tailwindcss: ^4.3.3`)
- **Test Runner:** Node.js built-in test runner (`node:test`, `node:assert/strict`)

---

## 3. Environment Configuration

Copy `.env.example` to `.env` to customize settings:

```bash
cp .env.example .env
```

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `3000` | Port on which the HTTP server listens. |
| `HOST` | `0.0.0.0` | Network interface to bind (`0.0.0.0` or `127.0.0.1`). |
| `NODE_ENV` | `development` | Runtime mode: `development` (with Vite middleware) or `production`. |

*Note: No secrets or credentials exist in this phase. Database connection parameters are deferred to Phase P02.*

---

## 4. Lifecycle Commands

All commands run through standard `npm` scripts:

### Dependency Installation
```bash
npm install
```

### Development Mode (Full-Stack)
Starts the Express server with Vite dev middleware enabled, binding to the configured host and port (default: `http://localhost:3000`):
```bash
npm run dev
```

### Type Checking & Linting
Validates TypeScript syntax and type safety without emitting build files:
```bash
npm run typecheck
# or
npm run lint
```

### Unit Tests
Executes the foundation test suite with Node's native test runner:
```bash
npm run test
```

### Production Build
Builds the client application into `dist/` and bundles the server into `dist/server.js`:
```bash
npm run build
```

### Production Start (Standalone Ubuntu / Node.js)
Runs the compiled server without development dependencies:
```bash
npm start
# or explicitly:
NODE_ENV=production node dist/server.js
```

---

## 5. Verification & Health Checks

### Backend Health Endpoint
The backend exposes `GET /health`:

```bash
curl -i http://localhost:3000/health
```

**Expected Response (HTTP 200 OK):**
```json
{
  "status": "ok",
  "service": "it-asset-management-backend",
  "phase": "P01 - Foundation",
  "uptime": 12.345,
  "timestamp": "2026-11-07T14:14:43.824Z"
}
```
*Note: This endpoint strictly reports process availability; it does not claim database connectivity or authentication readiness.*

### Frontend Initialization
When accessing `http://localhost:3000/` in a browser:
- React 19 boots inside `#root`.
- A neutral scaffold status card confirms frontend and backend initialization.
- No business logic, mock data, or product screens are rendered.

---

## 6. Scope Boundaries & Next Phase Handoff

### Strictly Excluded in Phase P01
- **Database:** No PostgreSQL tables, ORM models, migrations, seeds, or active DB connections.
- **Application Features:** No Asset CRUD, transfers, eForms, audit logs, verification, Excel import/export, data grids, or reports.
- **UI/UX:** No Admin Dashboard, Login forms, sidebars, navigation bars, or design systems.
- **Security:** No authentication, sessions, or user management.
- **External Services:** No Google Cloud, Gemini API, or 3rd-party vendor dependencies.

### Handoff to Phase P02
- Clean Modular Monolith layout ready for PostgreSQL schema, Drizzle/Prisma models, and database migration architecture in Phase P02.

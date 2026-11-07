# IT Asset Management System — Phase P01 (Project Foundation)

A clean, minimal, production-oriented full-stack project foundation for the IT Asset Management Web Application, designed for independent local deployment on Ubuntu Linux (including WSL2 and private VMs) and development in Google AI Studio.

---

## 1. Architecture Overview (Modular Monolith)

This repository implements **Phase P01 — Project Foundation**. It establishes a full-stack Modular Monolith architecture separating client-side and server-side code without introducing premature application features, design systems, or database models.

### Directory Structure

```
├── .env.example              # Non-secret environment variable template
├── .gitignore                # Source control exclusions
├── index.html                # HTML entry point (title, meta, root mount)
├── metadata.json             # AI Studio applet metadata
├── package.json              # Project manifest and lifecycle scripts
├── package-lock.json         # Deterministic npm dependency lockfile
├── tsconfig.json             # TypeScript compiler configuration (client, server, test)
├── vite.config.ts            # Vite client bundler and plugin configuration
├── server.ts                 # Full-stack entry point (dev middleware / prod static)
├── README.md                 # Foundation documentation (this file)
│
├── server/                   # Backend application (Node.js + Express + TypeScript)
│   ├── app.ts                # Express application factory, routing & error middleware
│   ├── config/
│   │   └── environment.ts    # Typed environment configuration loader with safe local defaults
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
└── test/                     # Foundation unit tests (node:test + node:assert)
    └── health.test.ts        # Health check and environment configuration tests
```

---

## 2. Core Frameworks & Dependencies

All dependencies are strictly limited to the minimal foundation requirements:

### Runtime Dependencies (`dependencies`)
- `dotenv` (`^17.2.3`): Environment configuration loading
- `express` (`^4.21.2`): Backend HTTP routing and middleware framework
- `react` (`^19.0.1`): Frontend UI library
- `react-dom` (`^19.0.1`): React DOM renderer

### Development Tooling (`devDependencies`)
- `typescript` (`^7.0.2`): TypeScript language and type checking (`tsc --noEmit`)
- `@types/node` (`^22.14.0`): Node.js type definitions
- `@types/express` (`^4.17.21`): Express type definitions
- `@types/react` (`^19.3.0`), `@types/react-dom` (`^19.3.0`): React type definitions
- `vite` (`^8.3.0`): Client-side bundler and dev server
- `@vitejs/plugin-react` (`^6.1.1`): React plugin for Vite
- `esbuild` (`^0.28.0`): Standalone server-side bundler
- `tsx` (`^4.21.0`): TypeScript execution engine for dev server and test runner

*No external UI component libraries, animation packages, AI SDKs, or CSS frameworks are included in this foundation.*

---

## 3. Environment Configuration & Network Binding

Copy `.env.example` to `.env` to configure settings:

```bash
cp .env.example .env
```

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `3000` | Port on which the HTTP server listens. |
| `HOST` | `127.0.0.1` | Network interface binding. Defaults strictly to local loopback. |
| `NODE_ENV` | `development` | Runtime mode: `development` (with Vite dev middleware) or `production`. |

### Network Binding Policy
- **Local Loopback (Default):** By default, `HOST` is `127.0.0.1`, restricting connections strictly to the local machine.
- **Private Network Binding (Opt-In):** To expose the application on a local private network or container interface, explicitly set `HOST="0.0.0.0"` in `.env`.

---

## 4. Lifecycle Commands

All package operations use **npm** and are locked with `package-lock.json`:

### Clean Dependency Installation
```bash
npm ci
```

### Development Mode (Full-Stack)
Starts the Express server with Vite dev middleware on `http://127.0.0.1:3000`:
```bash
npm run dev
```

### Type Checking
Validates TypeScript syntax and type safety across client, server, and test code:
```bash
npm run typecheck
# or
npm run lint
```

### Unit Tests
Executes the foundation test suite with Node's built-in test runner:
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
The backend exposes `GET /health` (and alias `GET /api/health`):

```bash
curl -i http://127.0.0.1:3000/health
```

**Response (HTTP 200 OK):**
```json
{
  "status": "ok",
  "service": "it-asset-management-backend",
  "phase": "P01 - Foundation",
  "uptime": 2.41,
  "timestamp": "2026-11-07T14:56:08.370Z"
}
```
*Note: This endpoint strictly reports process availability; it does not claim database connectivity or authentication readiness.*

### Frontend Bootstrap Verification
When accessing `http://127.0.0.1:3000/` in a browser, React 19 boots inside `#root` and renders a minimal neutral header confirming initialization.

---

## 6. Scope Boundaries & Next Phase Handoff

### Strictly Excluded in Phase P01
- **Database:** No PostgreSQL tables, ORM models, migrations, seeds, or active connections.
- **Application Features:** No Asset CRUD, transfers, eForms, audit logs, verification, Excel import/export, data grids, or reports.
- **UI/UX:** No Admin Dashboard, Login forms, sidebars, navigation bars, or design systems.
- **Security:** No authentication, sessions, or user management.
- **External Services:** No Google Cloud, Gemini API, or third-party vendor dependencies.

### Handoff to Phase P02
- Clean Modular Monolith layout ready for PostgreSQL schema, migration tooling, and repository architecture in Phase P02.

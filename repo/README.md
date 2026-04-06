# Community Fulfillment & Submission Operations Console

Offline-first React SPA with local IndexedDB persistence, frontend-only service layer, RBAC, tamper-evident audit logging, and runtime plugin extensions.

## Local Run (No Docker)

These steps are the primary verification path for delivery acceptance.

1. Install prerequisites
   - Node.js 18+ (Node 20 LTS recommended)
   - npm 9+
2. Install dependencies

```bash
npm install
```

3. Start the app locally

```bash
npm run dev
```

4. Open the local app
   - `http://localhost:5173`
5. Build production bundle

```bash
npm run build
```

6. Run unit tests

```bash
npm run test:unit
```

7. Run API-style router tests

```bash
npm run test:api
```

8. Run full verification sequence (recommended before handoff)

```bash
npm run test:unit && npm run test:api && npm run build
```

Notes:

- No backend server is required.
- No container runtime is required.
- No `.env` file setup is required.

## Architecture Constraints

- Fully offline: no external HTTP APIs.
- Persistence:
  - IndexedDB for business data (`src/db`).
  - LocalStorage only for lightweight UI preferences.
- Layering:
  - UI modules: `src/modules`
  - Business services: `src/services`
  - Auth/RBAC/security helpers: `src/auth`
  - Plugin host + manifest: `src/plugins`

## Critical Data Flows

### Bulk import rollback and validation

Code path: `src/services/bulkDataService.js`

- Supports CSV/JSON import for approved collections only.
- Enforces a hard file limit of 5,000 rows per import.
- Performs per-row schema validation (required fields + type coercion).
- Returns row-level errors with source row numbers (`422`) when validation fails.
- Uses all-or-nothing semantics:
  - if any row fails validation, nothing is written;
  - successful writes call repository `insertMany`, which executes in one IndexedDB transaction.

Automated coverage:

- `unit_tests/bulk_import.unit.test.js`

### Tamper-evident audit chain

Code path: `src/services/tamperAuditLogService.js`

- Each audit entry stores:
  - incremental sequence,
  - `previousHash` (or `GENESIS` for first record),
  - SHA-256 hash of canonicalized payload.
- Metadata is normalized and sensitive fields are masked before hashing/writing.
- `verifyChain()` recomputes expected links and hashes across the full sequence.
- Chain verification fails on:
  - hash edits,
  - previous-hash link breaks,
  - payload tampering.

Automated coverage:

- `unit_tests/security_and_integrity.unit.test.js`

### Plugin discovery and runtime extension

Code path: `src/plugins/pluginHost.js`

- Discovery is manifest-driven (`src/plugins/manifest.json`).
- Only enabled entries with allowed plugin types are admitted.
- Load/setup failures are isolated per plugin and captured in `listErrors()`.
- Runtime execution uses unified plugin interface (`read -> normalize -> write`).
- Runtime failures return safe error payloads and do not crash host execution.

Automated coverage:

- `unit_tests/plugin_and_performance.unit.test.js`

## Security Controls

- Router-boundary auth/authz enforcement for protected routes.
- Permission checks by role (`src/auth/roles.js`, `src/auth/rbac.js`).
- Scope/object-level checks for request access paths.
- Session timeout lock at 15 minutes idle.
- Login brute-force throttling with temporary lockout window.
- Sensitive value masking helpers for safe rendering/logging paths.

Automated coverage:

- `unit_tests/auth_and_router_guards.unit.test.js`
- `API_tests/router.api.test.js`
- `unit_tests/security_and_integrity.unit.test.js`

## Project Structure

```text
repo/
├── API_tests/
├── unit_tests/
├── src/
│   ├── app/
│   ├── auth/
│   ├── db/
│   ├── modules/
│   ├── plugins/
│   └── services/
└── README.md
```

## Optional Docker

Docker assets are provided for convenience only (`Dockerfile`, `docker-compose.yml`).
Delivery acceptance is validated using the local Node/npm flow above.

## Advanced Flows & Manual Verification

This project now includes static and automated test coverage for advanced plugin extension, admin configuration, message center, error/validation/edge states, and UI state transitions. See:

- `unit_tests/advanced_flows.unit.test.js`
- `unit_tests/error_and_edge_states.unit.test.js`
- `unit_tests/ui_state_transitions.unit.test.js`

Some runtime behaviors (e.g., browser camera access, IndexedDB persistence, plugin execution in real browser, UI rendering) still require manual verification in a real browser environment. All critical flows are covered by static code and tests, but final runtime/UX should be confirmed manually as part of acceptance.

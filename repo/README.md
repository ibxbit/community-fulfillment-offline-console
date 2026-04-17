# web

# Community Fulfillment & Submission Operations Console

Offline-first React SPA with local IndexedDB persistence, a frontend-only service layer, RBAC, tamper-evident audit logging, and runtime plugin extensions.

## Startup

Start the application with Docker Compose:

```bash
docker-compose up --build
```

Access the application at:

- `http://localhost:3000`

Notes:

- No backend server is required.
- No `.env` file setup is required.
- No manual database setup is required.
- Application state is stored in the browser via IndexedDB and LocalStorage.

## Verification Method

Use the following UI checks to confirm the system is working after `docker-compose up --build`:

1. Open `http://localhost:3000`.
2. Confirm the shell loads and the page shows `Community Fulfillment & Submission Operations Console`.
3. Confirm the System Status section shows `Bootstrapped: Yes`.
4. Sign in with one of the demo accounts below.
5. Verify role-aware UI behavior:
   - `student1` can create a draft request and submit it.
   - `reviewer1` can review and approve a submitted request.
   - `warehouse1` can access Fulfillment Management.
   - `admin1` can access Admin Configuration and Message Center management flows.
6. In Message Center, queue a message and verify it appears in queue/receipts views.
7. In Admin Configuration, save a service area and verify the saved row appears in the panel.

## Demo Credentials

Authentication is required.

Use these demo accounts:

| Role | Username | Password |
|---|---|---|
| Student | `student1` | `pass123` |
| Reviewer | `reviewer1` | `pass123` |
| Warehouse Staff | `warehouse1` | `pass123` |
| Operations | `ops1` | `pass123` |
| Finance | `finance1` | `pass123` |
| Admin | `admin1` | `pass123` |

These roles are the intended evaluation roles for access control and workflow verification.

## Testing

Automated tests in this repository cover:

- unit and component tests under `unit_tests/`
- router/API-style contract tests under `API_tests/`
- real HTTP integration tests under `http_tests/`
- browser workflow coverage under `e2e_tests/`

Repository test runner:

- `run_tests.sh`

## Tech Stack

- React 18
- Vite
- Vitest
- Playwright
- IndexedDB
- Docker / Docker Compose

## Architecture

Core layers:

- UI modules: `src/modules`
- App shell and providers: `src/app`
- Business services: `src/services`
- Auth and RBAC helpers: `src/auth`
- Persistence layer: `src/db`
- Plugin host and manifests: `src/plugins`

Key engineering constraints:

- Fully offline: no external HTTP APIs.
- Business data persists in IndexedDB.
- LocalStorage is limited to lightweight UI preferences.
- Route protection is enforced at the router boundary through auth and permission checks.

## Security And Roles

- Role-based permissions are defined in `src/auth/roles.js` and `src/auth/rbac.js`.
- Protected routes require authentication.
- Request workflows enforce scope/object-level access checks.
- Sessions use idle timeout behavior.
- Audit logging is tamper-evident.

## Key Workflows

### Request workflow

- Student creates a draft request.
- Student submits request for review.
- Reviewer approves, comments, returns, or attaches exception reasons.
- Student can archive an approved request.

### Fulfillment workflow

- Warehouse staff search shipments.
- Warehouse staff split shipments, assign carriers, confirm delivery, and log exceptions.

### Messaging workflow

- Users can view templates, queue, subscriptions, and receipts according to role and ownership rules.
- Admin flows can manage templates and cross-user messaging data where permitted.

### Admin workflow

- Admin can manage service areas.
- Admin can manage group-leader bindings.
- Admin can manage commission, settlement, and attribution rules.
- Admin can run bulk template/export/import flows.

## Project Structure

```text
repo/
├── API_tests/
├── e2e_tests/
├── http_tests/
├── unit_tests/
├── src/
│   ├── app/
│   ├── auth/
│   ├── db/
│   ├── modules/
│   ├── plugins/
│   └── services/
├── Dockerfile
├── docker-compose.yml
├── run_tests.sh
└── README.md
```

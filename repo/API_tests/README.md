# Router Contract Tests (API_tests/)

**These are NOT true HTTP tests.** They call `services.router.call(...)` directly,
testing the service-layer routing logic, auth guards, RBAC, and response contracts
without any HTTP transport.

For **true HTTP integration tests** that exercise a real Node.js HTTP server
with `fetch()`, see the `http_tests/` directory.

## Test Layers

| Layer | Directory | What it proves |
|---|---|---|
| Router contract | `API_tests/` | Route→handler wiring, auth, RBAC, payload shape |
| HTTP integration | `http_tests/` | Full transport: HTTP method, path, headers, JSON body, status codes |
| Unit / component | `unit_tests/` | Service logic, UI rendering, state transitions |

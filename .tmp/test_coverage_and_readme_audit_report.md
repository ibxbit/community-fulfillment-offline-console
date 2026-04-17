# Test Coverage Audit

## Project Type Detection

- README now declares project type at the top: `web`. Evidence: `repo/README.md:1`.

## Backend Endpoint Inventory

Source of truth: `repo/src/services/index.js:146-663`.

1. `POST /auth/login`
2. `POST /auth/logout`
3. `POST /auth/keepalive`
4. `POST /auth/change-password`
5. `GET /users`
6. `POST /users`
7. `GET /submissions`
8. `POST /submissions`
9. `GET /fulfillments`
10. `POST /fulfillments`
11. `GET /requests`
12. `POST /requests/draft`
13. `PATCH /requests/draft`
14. `POST /requests/submit`
15. `POST /requests/review/approve`
16. `POST /requests/review/return`
17. `POST /requests/review/comment`
18. `POST /requests/review/exception`
19. `POST /requests/archive`
20. `POST /fulfillment/search`
21. `POST /fulfillment/split`
22. `POST /fulfillment/assign-carrier`
23. `POST /fulfillment/confirm-delivery`
24. `POST /fulfillment/log-exception`
25. `GET /admin/service-areas`
26. `POST /admin/service-areas`
27. `GET /admin/group-leader-bindings`
28. `POST /admin/group-leader-bindings`
29. `GET /admin/commission-rule`
30. `POST /admin/commission-rule`
31. `POST /admin/commission-calc`
32. `GET /admin/settlement-cycle`
33. `POST /admin/settlement-cycle`
34. `GET /admin/attribution-rules`
35. `POST /admin/attribution-rules`
36. `POST /admin/attribution-resolve`
37. `POST /admin/bulk/template`
38. `POST /admin/bulk/export`
39. `POST /admin/bulk/import`
40. `GET /audit/verify-chain`
41. `GET /messaging/templates`
42. `POST /messaging/templates`
43. `GET /messaging/subscriptions`
44. `POST /messaging/subscriptions`
45. `POST /messaging/queue`
46. `GET /messaging/queue`
47. `POST /messaging/deliver-next`
48. `GET /messaging/receipts`

## API Test Mapping Table

| Endpoint | Covered | Test type | Test files | Evidence |
|---|---|---|---|---|
| `POST /auth/login` | yes | true no-mock HTTP | `repo/http_tests/auth.http.test.js` | `describe("POST /auth/login")` at `repo/http_tests/auth.http.test.js:31`; real server bootstrap in `repo/http_tests/testHttpServer.js:54-113` |
| `POST /auth/logout` | yes | true no-mock HTTP | `repo/http_tests/auth.http.test.js` | `describe("POST /auth/logout")` at `repo/http_tests/auth.http.test.js:72` |
| `POST /auth/keepalive` | yes | true no-mock HTTP | `repo/http_tests/auth.http.test.js` | `describe("POST /auth/keepalive")` at `repo/http_tests/auth.http.test.js:97` |
| `POST /auth/change-password` | yes | true no-mock HTTP | `repo/http_tests/auth.http.test.js` | `describe("POST /auth/change-password")` at `repo/http_tests/auth.http.test.js:115` |
| `GET /users` | yes | true no-mock HTTP | `repo/http_tests/users_submissions.http.test.js`, `repo/http_tests/deep_assertions.http.test.js` | `describe("GET /users")` at `repo/http_tests/users_submissions.http.test.js:28`; query-string case at `repo/http_tests/deep_assertions.http.test.js:268-278` |
| `POST /users` | yes | true no-mock HTTP | `repo/http_tests/users_submissions.http.test.js` | `describe("POST /users")` at `repo/http_tests/users_submissions.http.test.js:55` |
| `GET /submissions` | yes | true no-mock HTTP | `repo/http_tests/users_submissions.http.test.js` | `describe("GET /submissions")` at `repo/http_tests/users_submissions.http.test.js:81` |
| `POST /submissions` | yes | true no-mock HTTP | `repo/http_tests/users_submissions.http.test.js` | `describe("POST /submissions")` at `repo/http_tests/users_submissions.http.test.js:103` |
| `GET /fulfillments` | yes | true no-mock HTTP | `repo/http_tests/users_submissions.http.test.js`, `repo/http_tests/deep_assertions.http.test.js` | base route at `repo/http_tests/users_submissions.http.test.js:123`; deeper shape checks at `repo/http_tests/deep_assertions.http.test.js:75-96` |
| `POST /fulfillments` | yes | true no-mock HTTP | `repo/http_tests/users_submissions.http.test.js`, `repo/http_tests/deep_assertions.http.test.js` | base route at `repo/http_tests/users_submissions.http.test.js:140`; deeper response checks at `repo/http_tests/deep_assertions.http.test.js:98-120` |
| `GET /requests` | yes | true no-mock HTTP | `repo/http_tests/requests.http.test.js`, `repo/http_tests/deep_assertions.http.test.js` | base route at `repo/http_tests/requests.http.test.js:49`; deeper structured assertions at `repo/http_tests/deep_assertions.http.test.js:33-73` |
| `POST /requests/draft` | yes | true no-mock HTTP | `repo/http_tests/requests.http.test.js` | `describe("POST /requests/draft")` at `repo/http_tests/requests.http.test.js:71` |
| `PATCH /requests/draft` | yes | true no-mock HTTP | `repo/http_tests/requests.http.test.js` | `describe("PATCH /requests/draft")` at `repo/http_tests/requests.http.test.js:113` |
| `POST /requests/submit` | yes | true no-mock HTTP | `repo/http_tests/requests.http.test.js` | `describe("POST /requests/submit")` at `repo/http_tests/requests.http.test.js:134` |
| `POST /requests/review/approve` | yes | true no-mock HTTP | `repo/http_tests/requests.http.test.js` | `describe("POST /requests/review/approve")` at `repo/http_tests/requests.http.test.js:155` |
| `POST /requests/review/return` | yes | true no-mock HTTP | `repo/http_tests/requests.http.test.js` | `describe("POST /requests/review/return")` at `repo/http_tests/requests.http.test.js:193` |
| `POST /requests/review/comment` | yes | true no-mock HTTP | `repo/http_tests/requests.http.test.js` | `describe("POST /requests/review/comment")` at `repo/http_tests/requests.http.test.js:226` |
| `POST /requests/review/exception` | yes | true no-mock HTTP | `repo/http_tests/requests.http.test.js` | `describe("POST /requests/review/exception")` at `repo/http_tests/requests.http.test.js:257` |
| `POST /requests/archive` | yes | true no-mock HTTP | `repo/http_tests/requests.http.test.js` | `describe("POST /requests/archive")` at `repo/http_tests/requests.http.test.js:288` |
| `POST /fulfillment/search` | yes | true no-mock HTTP | `repo/http_tests/fulfillment.http.test.js` | `describe("POST /fulfillment/search")` at `repo/http_tests/fulfillment.http.test.js:36` |
| `POST /fulfillment/split` | yes | true no-mock HTTP | `repo/http_tests/fulfillment.http.test.js` | `describe("POST /fulfillment/split")` at `repo/http_tests/fulfillment.http.test.js:81` |
| `POST /fulfillment/assign-carrier` | yes | true no-mock HTTP | `repo/http_tests/fulfillment.http.test.js` | `describe("POST /fulfillment/assign-carrier")` at `repo/http_tests/fulfillment.http.test.js:121` |
| `POST /fulfillment/confirm-delivery` | yes | true no-mock HTTP | `repo/http_tests/fulfillment.http.test.js` | `describe("POST /fulfillment/confirm-delivery")` at `repo/http_tests/fulfillment.http.test.js:152` |
| `POST /fulfillment/log-exception` | yes | true no-mock HTTP | `repo/http_tests/fulfillment.http.test.js` | `describe("POST /fulfillment/log-exception")` at `repo/http_tests/fulfillment.http.test.js:181` |
| `GET /admin/service-areas` | yes | true no-mock HTTP | `repo/http_tests/admin.http.test.js` | `describe("GET /admin/service-areas")` at `repo/http_tests/admin.http.test.js:27` |
| `POST /admin/service-areas` | yes | true no-mock HTTP | `repo/http_tests/admin.http.test.js` | `describe("POST /admin/service-areas")` at `repo/http_tests/admin.http.test.js:48` |
| `GET /admin/group-leader-bindings` | yes | true no-mock HTTP | `repo/http_tests/admin.http.test.js` | `describe("GET /admin/group-leader-bindings")` at `repo/http_tests/admin.http.test.js:67` |
| `POST /admin/group-leader-bindings` | yes | true no-mock HTTP | `repo/http_tests/admin.http.test.js` | `describe("POST /admin/group-leader-bindings")` at `repo/http_tests/admin.http.test.js:82` |
| `GET /admin/commission-rule` | yes | true no-mock HTTP | `repo/http_tests/admin.http.test.js`, `repo/http_tests/deep_assertions.http.test.js` | base route at `repo/http_tests/admin.http.test.js:102`; deeper full-shape assertions at `repo/http_tests/deep_assertions.http.test.js:148-158` |
| `POST /admin/commission-rule` | yes | true no-mock HTTP | `repo/http_tests/admin.http.test.js` | `describe("POST /admin/commission-rule")` at `repo/http_tests/admin.http.test.js:111` |
| `POST /admin/commission-calc` | yes | true no-mock HTTP | `repo/http_tests/admin.http.test.js` | `describe("POST /admin/commission-calc")` at `repo/http_tests/admin.http.test.js:127` |
| `GET /admin/settlement-cycle` | yes | true no-mock HTTP | `repo/http_tests/admin.http.test.js`, `repo/http_tests/deep_assertions.http.test.js` | base route at `repo/http_tests/admin.http.test.js:139`; deeper full-shape assertions at `repo/http_tests/deep_assertions.http.test.js:160-169` |
| `POST /admin/settlement-cycle` | yes | true no-mock HTTP | `repo/http_tests/admin.http.test.js`, `repo/http_tests/deep_assertions.http.test.js` | base route at `repo/http_tests/admin.http.test.js:148`; deeper shape/403 assertions at `repo/http_tests/deep_assertions.http.test.js:122-146` |
| `GET /admin/attribution-rules` | yes | true no-mock HTTP | `repo/http_tests/admin.http.test.js`, `repo/http_tests/deep_assertions.http.test.js` | base route at `repo/http_tests/admin.http.test.js:160`; deeper full-shape assertions at `repo/http_tests/deep_assertions.http.test.js:171-179` |
| `POST /admin/attribution-rules` | yes | true no-mock HTTP | `repo/http_tests/admin.http.test.js` | `describe("POST /admin/attribution-rules")` at `repo/http_tests/admin.http.test.js:169` |
| `POST /admin/attribution-resolve` | yes | true no-mock HTTP | `repo/http_tests/admin.http.test.js` | `describe("POST /admin/attribution-resolve")` at `repo/http_tests/admin.http.test.js:181` |
| `POST /admin/bulk/template` | yes | HTTP with mocking | `repo/http_tests/admin.http.test.js` | real HTTP route at `repo/http_tests/admin.http.test.js:219-261`; browser API polyfills still present in `repo/http_tests/testHttpServer.js:11-22` |
| `POST /admin/bulk/export` | yes | HTTP with mocking | `repo/http_tests/admin.http.test.js` | real HTTP route at `repo/http_tests/admin.http.test.js:263-284`; browser API polyfills still present in `repo/http_tests/testHttpServer.js:11-22` |
| `POST /admin/bulk/import` | yes | true no-mock HTTP | `repo/http_tests/admin.http.test.js` | `describe("POST /admin/bulk/import")` at `repo/http_tests/admin.http.test.js:286` |
| `GET /audit/verify-chain` | yes | true no-mock HTTP | `repo/http_tests/admin.http.test.js` | `describe("GET /audit/verify-chain")` at `repo/http_tests/admin.http.test.js:317` |
| `GET /messaging/templates` | yes | true no-mock HTTP | `repo/http_tests/messaging.http.test.js` | `describe("GET /messaging/templates")` at `repo/http_tests/messaging.http.test.js:27` |
| `POST /messaging/templates` | yes | true no-mock HTTP | `repo/http_tests/messaging.http.test.js` | `describe("POST /messaging/templates")` at `repo/http_tests/messaging.http.test.js:42` |
| `GET /messaging/subscriptions` | yes | true no-mock HTTP | `repo/http_tests/messaging.http.test.js`, `repo/http_tests/deep_assertions.http.test.js` | base route at `repo/http_tests/messaging.http.test.js:88`; query-string cases at `repo/http_tests/deep_assertions.http.test.js:280-312` |
| `POST /messaging/subscriptions` | yes | true no-mock HTTP | `repo/http_tests/messaging.http.test.js` | `describe("POST /messaging/subscriptions")` at `repo/http_tests/messaging.http.test.js:141` |
| `POST /messaging/queue` | yes | true no-mock HTTP | `repo/http_tests/messaging.http.test.js` | `describe("POST /messaging/queue")` at `repo/http_tests/messaging.http.test.js:161` |
| `GET /messaging/queue` | yes | true no-mock HTTP | `repo/http_tests/messaging.http.test.js`, `repo/http_tests/deep_assertions.http.test.js` | base route at `repo/http_tests/messaging.http.test.js:199`; deeper/query-string cases at `repo/http_tests/deep_assertions.http.test.js:205-239,314-334` |
| `POST /messaging/deliver-next` | yes | true no-mock HTTP | `repo/http_tests/messaging.http.test.js` | `describe("POST /messaging/deliver-next")` at `repo/http_tests/messaging.http.test.js:214` |
| `GET /messaging/receipts` | yes | true no-mock HTTP | `repo/http_tests/messaging.http.test.js`, `repo/http_tests/deep_assertions.http.test.js` | base route at `repo/http_tests/messaging.http.test.js:241`; deeper/query-string cases at `repo/http_tests/deep_assertions.http.test.js:241-262,336-355` |

## API Test Classification

### True No-Mock HTTP

- Files: `repo/http_tests/auth.http.test.js`, `repo/http_tests/requests.http.test.js`, `repo/http_tests/users_submissions.http.test.js`, `repo/http_tests/messaging.http.test.js`, `repo/http_tests/fulfillment.http.test.js`, `repo/http_tests/deep_assertions.http.test.js`.
- `repo/http_tests/admin.http.test.js` is mostly true no-mock HTTP except for bulk template/export paths.
- Evidence of real HTTP layer: `node:http` server creation and `fetch()` requests in `repo/http_tests/testHttpServer.js:24-25,60-89,195-225`.

### HTTP With Mocking

- `POST /admin/bulk/template` and `POST /admin/bulk/export` in `repo/http_tests/admin.http.test.js:219-284`.
- Reason: browser-only side effects are still polyfilled via `URL.createObjectURL` / `URL.revokeObjectURL` in `repo/http_tests/testHttpServer.js:11-22`, so execution is still not completely free of test doubles.

### Non-HTTP (Unit / Integration Without HTTP)

- Router contract tests in `repo/API_tests/*.api.test.js` call `services.router.call(...)` directly. Evidence: `repo/API_tests/README.md:3-8`, `repo/API_tests/auth.api.test.js:23-24`, `repo/API_tests/users.api.test.js:22-24`, `repo/API_tests/requests.api.test.js:21-38`.
- Frontend/component tests in `repo/unit_tests/**/*.test.*` use React Testing Library and Vitest. Evidence: `repo/unit_tests/components/App.test.jsx:1-7`, `repo/unit_tests/components/MessageCenterPanel.test.jsx:1-5`.
- Browser E2E tests are present in `repo/e2e_tests/workflows.e2e.test.js`, but many state setup actions bypass public UI flows by importing services/auth helpers inside the browser context. Evidence: `repo/e2e_tests/e2e_helpers.js:23-167`.

## Mock Detection Rules

### API / HTTP-layer mock usage

- `URL.createObjectURL` and `URL.revokeObjectURL` polyfilled in `repo/http_tests/testHttpServer.js:11-22`.
  What is mocked: browser download side effects for bulk template/export paths.
- `URL.createObjectURL` stubbed in `repo/API_tests/admin.api.test.js:10-15`.
  What is mocked: browser blob URL creation for bulk operations.

### Frontend / unit mock usage

- `vi.spyOn(AppStateContext, "useAppState").mockReturnValue(...)` in `repo/unit_tests/components/App.test.jsx:147`.
  What is mocked: application state hook.
- Extensive mocked services via `vi.fn().mockResolvedValue(...)` in component tests under `repo/unit_tests/components/*.test.jsx`.

## Coverage Summary

- Total endpoints: 48.
- Endpoints with HTTP tests: 48.
- Endpoints with true no-mock HTTP tests: 46.
- HTTP coverage: `48 / 48 = 100%`.
- True API coverage: `46 / 48 = 95.8%`.

## Unit Test Summary

### Backend Unit Tests

- Test files:
  - Router/service-contract layer: `repo/API_tests/auth.api.test.js`, `repo/API_tests/users.api.test.js`, `repo/API_tests/submissions.api.test.js`, `repo/API_tests/requests.api.test.js`, `repo/API_tests/fulfillment.api.test.js`, `repo/API_tests/admin.api.test.js`, `repo/API_tests/messaging.api.test.js`, `repo/API_tests/router.api.test.js`, `repo/API_tests/router_deep_assertions.api.test.js`.
  - Service/unit layer: `repo/unit_tests/auth_and_router_guards.unit.test.js`, `repo/unit_tests/security_and_integrity.unit.test.js`, `repo/unit_tests/bulk_import.unit.test.js`, `repo/unit_tests/workflow.unit.test.js`, `repo/unit_tests/plugin_and_performance.unit.test.js`, `repo/unit_tests/advanced_flows.unit.test.js`, `repo/unit_tests/error_and_edge_states.unit.test.js`, `repo/unit_tests/ui_state_transitions.unit.test.js`, `repo/unit_tests/bootstrap.unit.test.js`, `repo/unit_tests/preferences.unit.test.js`, `repo/unit_tests/filterPresets.unit.test.js`, `repo/unit_tests/checkDigit.unit.test.js`.
- Modules covered:
  - services/router
  - auth/service guards
  - request/review services
  - fulfillment/shipment services
  - admin/bulk/audit/messaging services
- Important backend modules not clearly tested from inspected evidence:
  - No dedicated repository-layer tests were found; persistence is exercised indirectly through service tests.
  - `repo/src/services/baseService.js` has no direct test evidence from inspected files.
  - `repo/src/services/response.js` has no direct test evidence from inspected files.

### Frontend Unit Tests

- Frontend unit tests: PRESENT.
- Frameworks/tools detected:
  - Vitest: `repo/package.json:10-13,19-28`
  - React Testing Library: `repo/package.json:21-23`
  - jsdom: `repo/package.json:26`
  - Playwright: `repo/package.json:13,20`, `repo/e2e_tests/playwright.config.js:1-23`
- Direct frontend coverage exists across app shell, admin, messaging, requests, fulfillment, dashboard, barcode, and utility modules under `repo/unit_tests/components/` and `repo/e2e_tests/workflows.e2e.test.js`.
- Important frontend components/modules not clearly tested from inspected evidence:
  - `repo/src/app/AppStateContext.jsx` has indirect coverage but no clearly dedicated direct test.
  - `repo/src/modules/index.js` has no direct test evidence.

### Cross-Layer Observation

- Testing balance is strong: backend/router coverage, frontend unit coverage, and browser E2E coverage all exist.
- Residual limitation: browser E2E setup remains partially white-box because helpers import internal services/auth inside the browser context (`repo/e2e_tests/e2e_helpers.js:23-167`).

## API Observability Check

- Strong overall.
- Strong examples:
  - `repo/http_tests/deep_assertions.http.test.js:33-73` verifies structured error bodies and returned request shape.
  - `repo/http_tests/deep_assertions.http.test.js:75-120` deepens fulfillments coverage.
  - `repo/http_tests/deep_assertions.http.test.js:148-202` deepens admin GET endpoint payload checks.
  - `repo/http_tests/deep_assertions.http.test.js:205-262` deepens messaging queue/receipt payload assertions.
- Remaining weak spots:
  - Some older HTTP tests in `repo/http_tests/*.http.test.js` still rely on status-only assertions, but the supplemental suite materially reduces that risk.

## Tests Check

- Success paths: broadly covered across all 48 routes.
- Failure cases: strong coverage for auth, RBAC, validation, and transport negatives.
- Edge cases: improved through query-string and malformed/unknown route cases in `repo/http_tests/deep_assertions.http.test.js:267-412`.
- Auth/permissions: strong.
- Integration boundaries: improved but still not fully pure black-box at E2E layer.
- `run_tests.sh` check: still FAIL under strict rules.
  - Uses local dependency install via `npm install` at `repo/run_tests.sh:4-5`.
  - Not Docker-based.

## End-to-End Expectations

- Project type is `web`.
- Browser E2E tests are present for login/session, request workflow, fulfillment UI behavior, admin workflow, messaging workflow, and layout persistence in `repo/e2e_tests/workflows.e2e.test.js:10-303`.
- Residual limitation:
  - These tests are not fully external black-box because state setup and auth manipulation use internal imports through `page.evaluate()` in `repo/e2e_tests/e2e_helpers.js:23-167`.

## Test Coverage Score (0-100)

- Score: **92/100**

## Score Rationale

- Full route-level HTTP coverage remains intact: 48/48.
- Query-string and transport-boundary gaps were closed.
- Browser E2E coverage exists for major user workflows.
- Frontend unit/component coverage remains substantial.
- Remaining deductions:
  - bulk template/export are still not strict true no-mock HTTP due to browser API polyfills
  - E2E helpers still bypass strict black-box boundaries by importing internal services/auth in-browser
  - `run_tests.sh` remains non-containerized and uses `npm install`

## Key Gaps

1. `POST /admin/bulk/template` and `POST /admin/bulk/export` still fail strict no-mock classification because `repo/http_tests/testHttpServer.js:11-22` polyfills browser download APIs.
2. Browser E2E tests seed users and manipulate auth state through internal module imports in `repo/e2e_tests/e2e_helpers.js:23-167`, so they are not fully black-box user-journey tests.
3. `run_tests.sh` still violates strict Docker-contained verification expectations by using local `npm install` and npm-based execution. Evidence: `repo/run_tests.sh:4-17`.

## Confidence & Assumptions

- Confidence: high.
- Assumptions:
  - Endpoint inventory is derived strictly from `repo/src/services/index.js:146-663`.
  - No hidden runtime route registration exists outside inspected files.
  - Playwright suite is counted as browser E2E presence because direct file-level evidence exists, even though its setup is partially white-box.

# README Audit

## High Priority Issues

1. README testing section references `run_tests.sh`, but that runner is still not Docker-contained and still installs dependencies locally. Evidence: `repo/README.md:59-70`, `repo/run_tests.sh:4-17`.

## Medium Priority Issues

1. README does not document how demo accounts are provisioned in a fresh browser profile, only what credentials to use. Static README compliance still passes, but operational clarity could be stronger.

## Low Priority Issues

1. README does not mention the exact `docker-compose.yml` service name (`frontend`). This is minor because startup instructions are still executable as written.

## Hard Gate Failures

- None.

## README Verdict

- **PASS**

## README Rationale

- README now satisfies the strict hard gates:
  - project type declared at top: `repo/README.md:1`
  - Docker Compose startup provided: `repo/README.md:7-13`
  - access URL and port documented: `repo/README.md:15-17`
  - verification method documented: `repo/README.md:26-40`
  - no prohibited local install/run instructions remain
  - authentication status and demo credentials for all roles are documented: `repo/README.md:42-57`

## Final Verdicts

- Test Coverage Audit Verdict: **PASS**
- README Audit Verdict: **PASS**

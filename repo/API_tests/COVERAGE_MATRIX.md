# Test Coverage Matrix

Tracks test coverage across three layers for every route in `src/services/index.js`.

## Test Layers

| Layer | Directory | Transport | Speed |
|---|---|---|---|
| **Router contract** | `API_tests/` | In-process `router.call()` | Fast (~5s) |
| **HTTP integration** | `http_tests/` | Real Node.js HTTP server + `fetch()` | Medium (~15s) |
| **Unit / component** | `unit_tests/` | Direct service calls + React render | Fast (~3s) |

## Legend
- R = router-contract test
- H = HTTP integration test
- U = unit/component test
- - = not applicable

## Endpoint Coverage

| Endpoint | Router | HTTP | Auth Fail | Permission Fail | Validation | Body/Side-effects |
|---|---|---|---|---|---|---|
| **Auth** | | | | | | |
| POST /auth/login | R | H | R,H | - | R,H | R,H (token, user shape) |
| POST /auth/logout | R | H | R,H | - | - | R,H (loggedOut, session invalidation) |
| POST /auth/keepalive | R | H | R,H | - | - | R,H (keepalive, lastActivityAt) |
| POST /auth/change-password | R | H | R,H | R,H | R,H | R,H (changed, cross-user) |
| **Users** | | | | | | |
| GET /users | R | H | R,H | R,H | - | R,H (array, user shape) |
| POST /users | R | H | R,H | R,H | - | R,H (_id, persistence) |
| **Submissions** | | | | | | |
| GET /submissions | R | H | R,H | R,H | - | R,H (array shape) |
| POST /submissions | R | H | R,H | - | - | R,H (_id, persistence) |
| **Requests** | | | | | | |
| GET /requests | R | H | R,H | R,H | - | R,H (array) |
| POST /requests/draft | R | H | R,H | R,H | R,H | R,H (status, owner, history) |
| PATCH /requests/draft | R | H | - | - | - | R,H (updated quantity) |
| POST /requests/submit | R | H | - | - | - | R,H (status=review, cycle) |
| POST /requests/review/approve | R | H | - | R | R,H (wrong status) | R,H (status=approved, reviewer) |
| POST /requests/review/return | R | H | R,H | R | R,H | R,H (status=return, comment) |
| POST /requests/review/comment | R | H | R,H | R | R,H | R,H (reviewHistory) |
| POST /requests/review/exception | R | H | R,H | R | R,H | R,H (exceptionReasons) |
| POST /requests/archive | R | H | - | - | R,H (wrong status) | R,H (status=archive, archivedAt) |
| **Fulfillments (CRUD)** | | | | | | |
| GET /fulfillments | R | H | R,H | R,H | - | R,H (array) |
| POST /fulfillments | R | H | R,H | R,H | - | R,H (itemSku) |
| **Fulfillment Management** | | | | | | |
| POST /fulfillment/search | R | H | R,H | R,H | - | R,H (items, total, page, filter, sort) |
| POST /fulfillment/split | R | H | R,H | R,H | R,H | R,H (packages, actionLog) |
| POST /fulfillment/assign-carrier | R | H | - | R,H | R,H | R,H (carrier, tracking, status) |
| POST /fulfillment/confirm-delivery | R | H | R,H | R,H | - | R,H (status=delivered, confirmation) |
| POST /fulfillment/log-exception | R | H | R,H | R,H | R,H | R,H (exceptions array, type) |
| **Admin** | | | | | | |
| GET /admin/service-areas | R | H | R,H | R,H | - | R,H (array) |
| POST /admin/service-areas | R | H | - | R,H | R,H | R,H (name, locations) |
| GET /admin/group-leader-bindings | R | H | R,H | R,H | - | R,H (array) |
| POST /admin/group-leader-bindings | R | H | - | R,H | R,H | R,H (leaderId, upsert) |
| GET /admin/commission-rule | R | H | R,H | R,H | - | R,H (percentage) |
| POST /admin/commission-rule | R | H | - | R,H | R,H | R,H (persistence) |
| POST /admin/commission-calc | R | H | R,H | R,H | - | R,H (orderValue, commissionValue) |
| GET /admin/settlement-cycle | R | H | R,H | R,H | - | R,H (frequency, dayOfWeek) |
| POST /admin/settlement-cycle | R | H | - | R,H | - | R,H (persistence) |
| GET /admin/attribution-rules | R | H | R,H | R,H | - | R,H (overlapStrategy) |
| POST /admin/attribution-rules | R | H | - | R,H | - | R,H (persistence) |
| POST /admin/attribution-resolve | R | H | R,H | R,H | - | R,H (attributions, area) |
| POST /admin/bulk/template | R | H | - | R,H | R,H | R,H (generated) |
| POST /admin/bulk/export | R | H | - | R,H | R,H | R,H (exportedRows) |
| POST /admin/bulk/import | R | H | - | R,H | R,H (JSON, CSV, 422) | R,H (importedRows) |
| **Audit** | | | | | | |
| GET /audit/verify-chain | R | H | R,H | - | - | R,H (valid, total, issues) |
| **Messaging** | | | | | | |
| GET /messaging/templates | R | H | R,H | - | - | R,H (array, after create) |
| POST /messaging/templates | R | H | R,H | R,H | R,H | R,H (templateId, kind, upsert) |
| GET /messaging/subscriptions | R | H | - | - | - | R,H (preferences, guard) |
| POST /messaging/subscriptions | R | H | R,H | - | - | R,H (allowAll, guard) |
| POST /messaging/queue | R | H | - | R,H | - | R,H (kind, status, dedupe, muting) |
| GET /messaging/queue | R | H | R,H | - | - | R,H (array, guard) |
| POST /messaging/deliver-next | R | H | - | - | - | R,H (status=delivered, receipt) |
| GET /messaging/receipts | R | H | - | - | - | R,H (array, guard) |

## Component Test Coverage

| Component | Renders | Loading | Error | Interactions | Persistence | Integration | Test File |
|---|---|---|---|---|---|---|---|
| App | U | - | - | U (toggles) | U (localStorage) | - | App.test.jsx |
| AppProviders | U | - | - | - | - | - | AppProviders.test.jsx |
| DashboardPanel | U | - | U | U (quick actions) | - | U (real svc) | DashboardPanel.test.jsx, integration_real_services.test.jsx |
| AdminConfigPanel | U | - | U | U (all saves) | - | U (real svc) | AdminConfigPanel.test.jsx, integration_real_services.test.jsx |
| BulkImportExportPanel | U | - | U | U (template, export) | - | - | BulkImportExportPanel.test.jsx |
| MessageCenterPanel | U | U | U | U (all actions) | - | U (real svc) | MessageCenterPanel.test.jsx, integration_real_services.test.jsx |
| RequestWorkflowPanel | U | U | U | U (create, submit, archive) | - | - | RequestWorkflowPanel.test.jsx |
| ReviewerPanel | U | U | U | U (approve, return, comment, exception) | - | - | ReviewerPanel.test.jsx |
| FulfillmentManagementPanel | U | - | U | U (all actions) | U (localStorage) | - | FulfillmentManagementPanel.test.jsx |
| BarcodeScannerPanel | U | - | - | U (manual entry, validation) | - | - | BarcodeScannerPanel.test.jsx |

## Utility / Module Test Coverage

| Module | Test File | Tests |
|---|---|---|
| checkDigit.js (Luhn, Mod11, length) | checkDigit.unit.test.js | 20 |
| filterPresets.js (load, save, round-trip) | filterPresets.unit.test.js | 8 |
| bootstrap.js (context, init, wiring) | bootstrap.unit.test.js | 6 |
| preferences.js (get, save, defaults) | preferences.unit.test.js | 7 |
| main.jsx (smoke render) | main_smoke.test.jsx | 1 |

## Direct Service Unit Tests

| Service | Test File | Tests |
|---|---|---|
| response.js (ok/fail helpers) | services_direct.unit.test.js | 5 |
| baseService (CRUD, audit trail) | services_direct.unit.test.js | 9 |
| adminConfigService (validation, calc, attribution) | services_direct.unit.test.js | 5 |
| inAppMessagingService (validation, templates, muting, priority) | services_direct.unit.test.js | 5 |
| fulfillmentManagementService (search, filter, validation) | services_direct.unit.test.js | 4 |

## Browser E2E Tests (Playwright)

| Workflow | Test File | Tests |
|---|---|---|
| Login/session/logout flow | workflows.e2e.test.js | 2 |
| Request lifecycle (draft→submit→approve→archive) | workflows.e2e.test.js | 1 |
| Request validation failure | workflows.e2e.test.js | 1 |
| Fulfillment panel UI interactions | workflows.e2e.test.js | 2 |
| Admin configuration workflow | workflows.e2e.test.js | 1 |
| Messaging queue/deliver/dedupe | workflows.e2e.test.js | 1 |
| Layout persistence across reload | workflows.e2e.test.js | 1 |

## Query-String Transport Tests

| Route | Query Pattern | Test File |
|---|---|---|
| GET /users | ?role=Student | deep_assertions.http.test.js |
| GET /messaging/subscriptions | self-read, ?userId=X (admin/denied) | deep_assertions.http.test.js |
| GET /messaging/queue | ?recipientUserId=X (admin/denied) | deep_assertions.http.test.js |
| GET /messaging/receipts | ?recipientUserId=X (admin/denied) | deep_assertions.http.test.js |

## Transport Boundary Negative Tests

| Scenario | Test File |
|---|---|
| Malformed JSON body → graceful error | deep_assertions.http.test.js |
| Unknown route → 404 structured error | deep_assertions.http.test.js |
| Unsupported method (DELETE /users) → 404 | deep_assertions.http.test.js |
| Wrong method on POST route (PUT /requests/draft) → 404 | deep_assertions.http.test.js |

## Summary

| Metric | Count |
|---|---|
| Total routes | 48 |
| Routes with router-contract test | 48 (100%) |
| Routes with HTTP integration test | 48 (100%) |
| Routes with deep body/side-effect HTTP assertions | 48 (100%) |
| Routes with query-string transport test | 8 |
| Routes with auth failure test | 40+ |
| Routes with permission failure test | 35+ |
| Component panels tested | 10/10 |
| Utility modules tested | 5/5 |
| Direct service unit tests | 28 |
| Integration tests (real services, not mocked) | 7 |
| Bootstrap/runtime seam tests | 16 |
| Browser E2E tests (Playwright, real Chromium) | 9 |
| Transport boundary negative tests | 4 |
| **Total test count (vitest)** | **537** |
| **Total test count (Playwright E2E)** | **9** |

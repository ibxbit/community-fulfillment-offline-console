# API Specification: Community Fulfillment & Submission Operations Console

## 1. Scope

This document defines the offline API contract implemented inside the React SPA service layer. The API is Express-style (request/response semantics), but all persistence and processing are browser-local:

- Primary persistence: IndexedDB
- Preferences/state: LocalStorage
- Import/export: Local file APIs (CSV/JSON)
- Networking: none required for core operation

## 2. Conventions

- Base path: `/api/v1`
- Content type: `application/json`
- Time format: ISO 8601 UTC timestamps
- ID format: ULID/UUID string
- Pagination: `page` (1-based), `pageSize` (default 20, max 200)
- Sorting: `sortBy`, `sortOrder` (`asc` | `desc`)

### 2.1 Standard Response Envelope

Success:

```json
{
	"ok": true,
	"data": {},
	"meta": {
		"requestId": "req_01JZ...",
		"timestamp": "2026-04-02T12:00:00.000Z"
	}
}
```

Error:

```json
{
	"ok": false,
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "quantity must be greater than 0",
		"details": [
			{
				"field": "quantity",
				"reason": "MIN_VALUE"
			}
		]
	},
	"meta": {
		"requestId": "req_01JZ...",
		"timestamp": "2026-04-02T12:00:00.000Z"
	}
}
```

## 3. Authentication & Session

Local username/password only. Passwords are stored as PBKDF2-derived hashes (Web Crypto).

### 3.1 Login

- `POST /auth/login`

Request:

```json
{
	"username": "ops.user",
	"password": "plainTextInput"
}
```

Response data:

```json
{
	"sessionId": "sess_01JZ...",
	"user": {
		"id": "usr_01",
		"username": "ops.user",
		"roles": ["Operations"],
		"scope": {
			"orgIds": ["org_100"],
			"classIds": []
		}
	},
	"idleTimeoutMinutes": 15,
	"expiresAt": "2026-04-02T12:15:00.000Z"
}
```

### 3.2 Logout

- `POST /auth/logout`

### 3.3 Session Keepalive

- `POST /auth/keepalive`

### 3.4 Password Change

- `POST /auth/change-password`

Request:

```json
{
	"currentPassword": "old",
	"newPassword": "newStrongPassword"
}
```

## 4. RBAC & Authorization

Role set:

- `Student`
- `Teacher`
- `WarehouseStaff`
- `Operations`
- `Finance`
- `Admin`

Authorization rules combine:

- Role/resource permission matrix
- Org/class scope checks

### 4.1 Permission Check (internal utility endpoint)

- `POST /auth/authorize`

Request:

```json
{
	"resource": "request",
	"action": "update",
	"context": {
		"orgId": "org_100",
		"classId": "class_20"
	}
}
```

## 5. Requests Workflow API

Status lifecycle:

- `draft -> submitted -> in_review -> approved`
- return path: `in_review -> returned`
- terminal: `archived`

### 5.1 Create Draft Request

- `POST /requests`

Request:

```json
{
	"requestType": "Student",
	"requestingOrgId": "org_100",
	"requestingClassId": "class_20",
	"items": [
		{
			"sku": "SKU-ALPHA-001",
			"quantity": 4
		}
	],
	"deliveryWindow": {
		"start": "2026-04-03T08:00:00.000Z",
		"end": "2026-04-03T12:00:00.000Z"
	}
}
```

### 5.2 List/Search Requests

- `GET /requests?status=submitted&requestType=Teacher&orgId=org_100&page=1&pageSize=20&sortBy=updatedAt&sortOrder=desc`

### 5.3 Get Request by ID

- `GET /requests/:requestId`

### 5.4 Update Draft/Returned Request

- `PATCH /requests/:requestId`

Behavioral rule:

- If request was previously approved and one of key fields changes (`requestingOrgId`, `requestingClassId`, `items[].sku`, `items[].quantity`, `deliveryWindow`), set `secondaryReviewRequired = true` and transition to `in_review`.

### 5.5 Submit Request

- `POST /requests/:requestId/submit`

### 5.6 Return Request

- `POST /requests/:requestId/return`

Request:

```json
{
	"reasonCode": "MISSING_INFO",
	"comment": "Please attach supporting class roster."
}
```

### 5.7 Approve Request

- `POST /requests/:requestId/approve`

### 5.8 Archive Request

- `POST /requests/:requestId/archive`

### 5.9 Add Reviewer Comment

- `POST /requests/:requestId/comments`

Request:

```json
{
	"comment": "Verified inventory and class scope.",
	"exceptionReason": null
}
```

Comment entries are timestamped and immutable.

## 6. Fulfillment Operations API

### 6.1 Unified Fulfillment Search

- `GET /fulfillment/search?sku=SKU-ALPHA-001&lot=LOT-22A&warehouseLocation=A1-03&documentStatus=approved&requester=teacher.jane&from=2026-04-01&to=2026-04-30&page=1&pageSize=25&sortBy=requestedAt&sortOrder=desc`

### 6.2 Save Filter Preset

- `POST /fulfillment/filter-presets`

Request:

```json
{
	"name": "April Approved Aisle A",
	"filters": {
		"documentStatus": ["approved"],
		"warehouseLocation": "A*",
		"from": "2026-04-01",
		"to": "2026-04-30"
	}
}
```

### 6.3 List Filter Presets

- `GET /fulfillment/filter-presets`

### 6.4 Split Shipment

- `POST /shipments/:shipmentId/split`

Request:

```json
{
	"packages": [
		{
			"packageRef": "PKG-1",
			"items": [{ "sku": "SKU-ALPHA-001", "quantity": 2 }]
		},
		{
			"packageRef": "PKG-2",
			"items": [{ "sku": "SKU-ALPHA-001", "quantity": 2 }]
		}
	]
}
```

### 6.5 Assign Carrier & Tracking

- `POST /shipments/:shipmentId/carrier`

Request:

```json
{
	"carrierName": "LocalCourier",
	"trackingNumber": "TRK123456789"
}
```

### 6.6 Record Delivery Confirmation

- `POST /shipments/:shipmentId/deliver`

Request:

```json
{
	"deliveredAt": "2026-04-02T10:30:00.000Z",
	"recipientName": "Front Office",
	"proof": "manual-signoff"
}
```

### 6.7 Log Fulfillment Exception

- `POST /shipments/:shipmentId/exceptions`

Request:

```json
{
	"code": "DAMAGED",
	"note": "Outer box torn on arrival"
}
```

Supported codes include `DAMAGED`, `RECIPIENT_UNAVAILABLE`, `LOST_IN_TRANSIT`, `OTHER`.

## 7. Barcode API

### 7.1 Parse/Validate Barcode

- `POST /barcode/validate`

Request:

```json
{
	"rawCode": "012345678905",
	"checkDigitRule": "MOD10"
}
```

Response data:

```json
{
	"isValid": true,
	"normalizedCode": "012345678905",
	"parsed": {
		"sku": "SKU-ALPHA-001"
	}
}
```

### 7.2 Barcode Lookup in Fulfillment

- `GET /barcode/lookup/:rawCode`

## 8. Admin Configuration API

### 8.1 Service Areas

- `GET /admin/service-areas`
- `POST /admin/service-areas`
- `PATCH /admin/service-areas/:serviceAreaId`

### 8.2 Group Leader Location Binding

- `POST /admin/service-areas/:serviceAreaId/leaders`

Request:

```json
{
	"leaderId": "leader_01",
	"locationIds": ["loc_001", "loc_002"]
}
```

### 8.3 Commission Rules

- `GET /admin/commission-rules`
- `POST /admin/commission-rules`

Request:

```json
{
	"name": "Default Leader Commission",
	"ratePercent": 3.5,
	"rounding": "NEAREST_CENT",
	"effectiveFrom": "2026-04-01"
}
```

### 8.4 Settlement Cycles

- `GET /admin/settlement-cycles`
- `POST /admin/settlement-cycles`

Request:

```json
{
	"name": "Weekly Friday",
	"cadence": "WEEKLY",
	"dayOfWeek": "FRIDAY",
	"timeLocal": "18:00"
}
```

### 8.5 Attribution Rules for Overlap

- `GET /admin/attribution-rules`
- `POST /admin/attribution-rules`

## 9. Bulk Import/Export API

### 9.1 Download Template

- `GET /bulk/templates/:entity?format=csv|json`

Entities include `requests`, `items`, `leaders`, `serviceAreas`.

### 9.2 Import File (Client-Side Parse + Validate)

- `POST /bulk/import/:entity`

Request:

```json
{
	"fileHandleId": "local_file_ref",
	"format": "csv",
	"dryRun": false
}
```

Rules:

- Max rows per file: 5000
- Validate required columns and data types
- Row-level errors returned with index and field name
- All-or-nothing rollback on any validation failure

Import result:

```json
{
	"summary": {
		"rowsRead": 320,
		"rowsValid": 320,
		"rowsInvalid": 0,
		"committed": true
	},
	"errors": []
}
```

### 9.3 Export Dataset

- `POST /bulk/export/:entity`

Request:

```json
{
	"format": "json",
	"filters": {
		"status": ["approved"]
	}
}
```

## 10. Plugin Management API

Plugins are discovered from local manifest (`plugins/manifest.json`) and loaded at runtime.

### 10.1 List Plugins

- `GET /plugins`

### 10.2 Validate Plugin Manifest

- `POST /plugins/validate-manifest`

### 10.3 Execute Plugin Pipeline

- `POST /plugins/run`

Request:

```json
{
	"adapter": "localJsonAdapter",
	"parser": "jsonParser",
	"cleaner": "basicCleaner",
	"targetStore": "requests"
}
```

## 11. Audit & Integrity API

All state-changing actions append tamper-evident audit records with hash chaining.

### 11.1 List Audit Records

- `GET /audit?entityType=request&entityId=req_01&page=1&pageSize=50`

### 11.2 Verify Audit Chain

- `POST /audit/verify`

Response data:

```json
{
	"isValid": true,
	"brokenAtRecordId": null
}
```

## 12. Message Center API

In-app only notifications (no email/SMS/push).

### 12.1 Publish Message

- `POST /messages/publish`

Request:

```json
{
	"templateKey": "REQUEST_APPROVED",
	"priority": "HIGH",
	"recipientUserIds": ["usr_01"],
	"variables": {
		"requestId": "req_01"
	},
	"dedupeWindowSeconds": 60
}
```

### 12.2 List Inbox

- `GET /messages/inbox?status=UNREAD&page=1&pageSize=20`

### 12.3 Acknowledge / Read Receipt

- `POST /messages/:messageId/read`

### 12.4 Subscription Preferences

- `GET /messages/preferences`
- `PATCH /messages/preferences`

## 13. Preferences API

LocalStorage-backed user preferences.

- `GET /preferences`
- `PATCH /preferences`

Example keys:

- `ui.sidebarCollapsed`
- `filters.fulfillment.lastUsed`
- `tables.fulfillment.columns`

## 14. Error Codes

- `AUTH_INVALID_CREDENTIALS`
- `AUTH_SESSION_EXPIRED`
- `AUTH_FORBIDDEN`
- `VALIDATION_ERROR`
- `WORKFLOW_TRANSITION_INVALID`
- `SECONDARY_REVIEW_REQUIRED`
- `IMPORT_ROW_LIMIT_EXCEEDED`
- `IMPORT_VALIDATION_FAILED`
- `BARCODE_INVALID_CHECK_DIGIT`
- `AUDIT_CHAIN_BROKEN`
- `PLUGIN_MANIFEST_INVALID`
- `NOT_FOUND`
- `CONFLICT`
- `INTERNAL_ERROR`

## 15. Offline Guarantees

- All endpoints execute without network.
- Transactions that update multiple records use IndexedDB transactions.
- Import operations commit only if full batch passes validation.
- Local-first conflict model is not required because no remote sync is in scope for this milestone.

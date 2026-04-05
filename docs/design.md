# Design Document: Community Fulfillment & Submission Operations Console

## 1. Overview

This system is a fully offline, responsive React SPA for school districts and neighborhood group-leader operations. It provides request submission/review workflows, fulfillment operations, barcode-assisted handling, admin configuration, and local messaging while running entirely in-browser.

Primary goals:

- Zero network dependency for core features
- Strong workflow integrity and auditability
- Fast operations UX for fulfillment users
- Extensible data ingestion through local plugins

## 2. Architecture

## 2.1 High-Level Layers

1. Presentation layer (React modules/panels)
2. Application service layer (Express-like route dispatcher)
3. Domain logic layer (workflow, rules, authorization)
4. Persistence layer (IndexedDB repositories)
5. Preferences/config layer (LocalStorage)
6. Integration utilities (CSV/JSON import/export, plugin host, barcode scanner)

## 2.2 Existing Project Mapping

- App shell/state/bootstrap: `src/app/*`
- Domain modules/UI panels: `src/modules/*`
- Auth and security: `src/auth/*`
- Data abstraction: `src/db/*`
- Service API emulation: `src/services/*`
- Plugin framework: `src/plugins/*`

## 3. Core Domain Design

## 3.1 Request Lifecycle

Workflow states:

- `draft`
- `submitted`
- `in_review`
- `returned`
- `approved`
- `archived`

Transitions:

- Draft authoring: `draft -> submitted`
- Review loop: `submitted|returned -> in_review`
- Reviewer return: `in_review -> returned`
- Approval: `in_review -> approved`
- Terminal close: `approved|returned -> archived`

Secondary review trigger rule:

- After first approval, if any key field changes (`requesting org/class`, `item SKU`, `quantity`, `delivery window`), set `secondaryReviewRequired = true`, move status back to `in_review`, and log an audit event.

## 3.2 Fulfillment Operations

Fulfillment users work from one consolidated search surface:

- Multi-criteria filtering (SKU/item, lot, location, status, requester, date range)
- Sortable/paginated tabular results
- Saved filter presets for repeat usage
- Drawer fast-actions:
	- Split shipment into packages
	- Assign carrier/tracking
	- Confirm delivery
	- Record exceptions (`damaged`, `recipient unavailable`, etc.)

## 3.3 Barcode Flow

- Primary: device camera scanner component
- Fallback: manual barcode entry field
- Validation: configurable check-digit policy (for example MOD10)
- Result: barcode resolves to entity context (SKU/shipment/request) and opens action-ready panel

## 3.4 Admin Configuration

Admin capabilities:

- Maintain service areas and location mapping
- Bind group leaders to service-area locations
- Configure commission rules (ex: 3.5% of attributed value, nearest-cent rounding)
- Configure settlement cycles (ex: weekly Friday 18:00 local)
- Define overlap attribution rules for multiple leaders in one service area

## 4. Data Design

## 4.1 IndexedDB Stores (Collections)

Proposed stores:

- `users`
- `sessions`
- `requests`
- `requestComments`
- `shipments`
- `shipmentPackages`
- `shipmentExceptions`
- `serviceAreas`
- `leaders`
- `leaderLocationBindings`
- `commissionRules`
- `settlementCycles`
- `attributionRules`
- `messages`
- `messageReceipts`
- `auditLogs`
- `plugins`
- `importJobs`

Index examples:

- `requests`: `status`, `requestType`, `requestingOrgId`, `updatedAt`
- `shipments`: `status`, `carrierName`, `deliveryDate`
- `messages`: `recipientUserId`, `status`, `priority`, `createdAt`
- `auditLogs`: `entityType+entityId`, `createdAt`

## 4.2 LocalStorage Keys

- `pref.ui.layout`
- `pref.ui.tableState.fulfillment`
- `pref.filters.lastUsed.fulfillment`
- `pref.messages.subscriptions`

## 4.3 Entity Notes

Request entity includes:

- requester metadata (type, org, class)
- line items (`sku`, `quantity`)
- workflow state and review metadata
- revision counter to detect post-approval edits

Audit entity includes:

- event payload snapshot (or summary)
- previous hash
- current hash
- actor, action, timestamp

## 5. Security & Integrity

## 5.1 Authentication

- Username/password local auth only
- Password derivation: PBKDF2 (Web Crypto) with per-user salt and configured iteration count
- Session auto-lock after 15 minutes idle

## 5.2 Authorization

- RBAC by role and resource action
- Scope checks for org/class restrictions
- Service-layer guard functions enforce permission before mutation

## 5.3 Sensitive Data Handling

- UI masking strategy for sensitive fields (ex: partial address rendering)
- Internal full values remain in secure store context where required for operations

## 5.4 Tamper-Evident Audit

- Every create/update/approve/ship mutation writes an audit record
- Records are hash-chained; verification detects deletions/reordering/modification

## 6. Bulk Import/Export Design

## 6.1 Import Pipeline

1. User selects CSV/JSON file
2. Client parser reads file locally
3. Template validator checks required columns and types
4. Row count guard enforces max 5,000 rows
5. Row-level errors accumulated
6. If any row fails, rollback transaction (all-or-nothing)
7. If all pass, commit in single logical transaction and record import job

## 6.2 Export Pipeline

- Data filtered in memory/IndexedDB cursor
- Serialize to CSV/JSON in browser
- Download via Blob/FileSaver without server roundtrip

## 7. Plugin Architecture

## 7.1 Discovery & Loading

- Local manifest file defines plugin modules and versions
- Plugin host validates manifest schema at startup
- Eligible plugins are registered to runtime module registry

## 7.2 Unified Plugin Interfaces

- Adapter: reads source files/blobs
- Parser: transforms raw content to records
- Cleaner: normalizes and sanitizes fields
- Storage backend adapter: persists normalized records to IndexedDB

## 7.3 Safety Controls

- Strict contract checks on plugin outputs
- Error isolation so one plugin failure does not corrupt core stores
- Audit record generated for plugin-driven data writes

## 8. Message Center Design

- In-app channel only
- Template + variable rendering engine
- Per-user subscription preferences
- Deduplication window: 60 seconds (same template + recipient + key payload)
- Priority queue processing (`HIGH`, `NORMAL`, `LOW`)
- Delivery/read receipts persisted locally

## 9. UX & Performance Considerations

- Mobile-first responsive layout for operational usage
- Table virtualization or incremental rendering for large result sets
- Debounced filter/search inputs
- IndexedDB index usage to keep query latency low
- Drawer fast actions minimize navigation context switches

## 10. Error Handling Strategy

- Consistent API error envelope
- User-facing actionable messages for validation and workflow errors
- Import error report with row number + field + reason
- Recovery options for scanner errors (manual entry fallback)

## 11. Testing Strategy

Unit focus:

- Workflow transition rules and secondary-review trigger
- Authorization guards and scope checks
- Check-digit validation logic
- Commission/settlement calculations and rounding
- Audit chain creation and verification

Integration focus:

- Service-layer endpoint behavior over IndexedDB repositories
- Bulk import rollback behavior on partial invalid datasets
- Plugin pipeline contract compliance

UI focus:

- Fulfillment table filtering/sorting/pagination
- Drawer action flows (split, ship, confirm, exception)
- Auto-lock and re-auth behavior

## 12. Non-Functional Requirements

- Fully offline operation in supported modern browsers
- Data durability through IndexedDB transactions
- Predictable behavior with no backend availability assumptions
- Audit integrity verification available on demand
- Accessibility and responsiveness for desktop and tablet/mobile workflows

## 13. Open Decisions

- Final check-digit algorithms to enable by default
- Detailed conflict strategy for future online sync (out of current scope)
- Data retention policy for archived records and audit log compaction

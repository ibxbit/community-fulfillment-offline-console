/**
 * Supplementary deep-assertion tests for routes that previously had
 * shallow status-only checks in router.api.test.js (Issue 4).
 *
 * Verifies response body shape, persisted side effects, and error payloads.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ROLES } from "../src/auth/roles";
import {
  createApiTestContext,
  clearAll,
  seedAllUsers,
  loginAs,
} from "./apiTestHelpers";

describe("Deep response assertions for previously shallow tests", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createApiTestContext());
    await clearAll(services);
    await seedAllUsers(services);
  });

  // ── POST /auth/login — verify response body shape ──

  describe("POST /auth/login response body", () => {
    it("returns token and user object on success", async () => {
      const result = await services.router.call("POST /auth/login", {
        username: "student1",
        password: "pass123",
      });

      expect(result.status).toBe(200);
      expect(result.data.token).toBeTruthy();
      expect(typeof result.data.token).toBe("string");
      expect(result.data.user).toBeTruthy();
      expect(result.data.user._id).toBe("student_1");
      expect(result.data.user.username).toBe("student1");
      expect(result.data.user.role).toBe(ROLES.STUDENT);
      expect(result.error).toBeNull();
    });

    it("returns structured error on failure", async () => {
      const result = await services.router.call("POST /auth/login", {
        username: "student1",
        password: "wrong",
      });

      expect(result.status).toBe(401);
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.error.message).toBeTruthy();
      expect(typeof result.error.message).toBe("string");
    });

    it("returns 400 for missing credentials", async () => {
      const result = await services.router.call("POST /auth/login", {
        username: "",
        password: "",
      });

      expect(result.status).toBe(400);
      expect(result.error.message).toContain("required");
    });
  });

  // ── Unauthenticated access — verify error payload shape ──

  describe("unauthenticated access error payload", () => {
    it("returns structured 401 with message", async () => {
      const result = await services.router.call("GET /audit/verify-chain", {});

      expect(result.status).toBe(401);
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.error.message).toBe("Authentication required");
    });
  });

  // ── Permission denied — verify error payload shape ──

  describe("permission denied error payload", () => {
    it("returns structured 403 with message for shipment route", async () => {
      const token = await loginAs(services, "finance1");
      const shipment = await services.db.collections.shipments.insertOne({
        itemSku: "SKU-1",
        requester: "user_1",
        date: new Date().toISOString(),
      });

      const result = await services.router.call(
        "POST /fulfillment/assign-carrier",
        {
          auth: { token },
          actor: { userId: "finance_1", role: ROLES.FINANCE },
          shipmentId: shipment._id,
          carrier: "CarrierX",
          trackingNumber: "TRK-1",
        },
      );

      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.error.message).toBe("Permission denied");
    });

    it("returns structured 403 for admin route", async () => {
      const token = await loginAs(services, "finance1");

      const result = await services.router.call("POST /admin/service-areas", {
        auth: { token },
        name: "Area A",
        locations: ["loc-1"],
      });

      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── Scope isolation — verify 403 body and persisted state ──

  describe("scope isolation deep assertions", () => {
    it("returns 403 with scope message when cross-user access is denied", async () => {
      const token1 = await loginAs(services, "student1");

      const created = await services.router.call("POST /requests/draft", {
        auth: { token: token1 },
        actor: { userId: "student_1", role: ROLES.STUDENT },
        data: {
          requestingOrgId: "org_a",
          requestingClassId: "class_a",
          itemSku: "SKU-SCOPE",
          quantity: 1,
        },
      });
      expect(created.status).toBe(201);

      const token2 = await loginAs(services, "student2");
      const denied = await services.router.call("PATCH /requests/draft", {
        auth: { token: token2 },
        actor: { userId: "student_2", role: ROLES.STUDENT },
        requestId: created.data._id,
        patch: { quantity: 99 },
      });

      expect(denied.status).toBe(403);
      expect(denied.data).toBeNull();
      expect(denied.error).toBeTruthy();
      expect(denied.error.message).toContain("Scope");

      // Verify original data was NOT modified
      const original = await services.db.collections.requests.findOne({
        _id: created.data._id,
      });
      expect(original.quantity).toBe(1);
    });
  });

  // ── Full flow — verify persisted state at each step ──

  describe("draft-submit-approve-archive flow with persistence checks", () => {
    it("verifies DB state after each transition", async () => {
      const studentToken = await loginAs(services, "student1");

      // Create draft
      const created = await services.router.call("POST /requests/draft", {
        auth: { token: studentToken },
        actor: { userId: "student_1", role: ROLES.STUDENT },
        data: {
          requestingOrgId: "org_a",
          requestingClassId: "class_a",
          itemSku: "SKU-FLOW",
          quantity: 3,
        },
      });
      expect(created.status).toBe(201);
      expect(created.data.status).toBe("draft");
      expect(created.data.ownerUserId).toBe("student_1");

      const requestId = created.data._id;

      // Verify in DB
      const dbDraft = await services.db.collections.requests.findOne({
        _id: requestId,
      });
      expect(dbDraft.status).toBe("draft");
      expect(dbDraft.itemSku).toBe("SKU-FLOW");

      // Submit
      const submitted = await services.router.call("POST /requests/submit", {
        auth: { token: studentToken },
        actor: { userId: "student_1", role: ROLES.STUDENT },
        requestId,
      });
      expect(submitted.status).toBe(200);
      expect(submitted.data.status).toBe("review");
      expect(submitted.data.reviewCycle).toBe(1);

      const dbSubmitted = await services.db.collections.requests.findOne({
        _id: requestId,
      });
      expect(dbSubmitted.status).toBe("review");

      // Approve
      const reviewerToken = await loginAs(services, "reviewer1");
      const approved = await services.router.call(
        "POST /requests/review/approve",
        {
          auth: { token: reviewerToken },
          actor: { userId: "reviewer_1", role: ROLES.REVIEWER },
          requestId,
          comment: "Looks good",
        },
      );
      expect(approved.status).toBe(200);
      expect(approved.data.status).toBe("approved");
      expect(approved.data.reviewedByUserId).toBe("reviewer_1");

      const dbApproved = await services.db.collections.requests.findOne({
        _id: requestId,
      });
      expect(dbApproved.status).toBe("approved");
      expect(dbApproved.fulfillmentBlocked).toBe(false);

      // Archive
      const newStudentToken = await loginAs(services, "student1");
      const archived = await services.router.call("POST /requests/archive", {
        auth: { token: newStudentToken },
        actor: { userId: "student_1", role: ROLES.STUDENT },
        requestId,
      });
      expect(archived.status).toBe(200);
      expect(archived.data.status).toBe("archive");

      const dbArchived = await services.db.collections.requests.findOne({
        _id: requestId,
      });
      expect(dbArchived.status).toBe("archive");
      expect(dbArchived.fulfillmentBlocked).toBe(true);
    });
  });

  // ── Messaging flow — verify queue state, dedupe, and receipts ──

  describe("messaging flow with persistence checks", () => {
    it("verifies queue state, dedupe fingerprinting, and receipt creation", async () => {
      const token = await loginAs(services, "student1");

      // Queue a message
      const queued = await services.router.call("POST /messaging/queue", {
        auth: { token },
        recipientUserId: "student_1",
        title: "Alert",
        body: "Something happened",
        priority: "normal",
      });
      expect(queued.status).toBe(201);
      expect(queued.data.kind).toBe("message");
      expect(queued.data.status).toBe("queued");
      expect(queued.data.fingerprint).toBeTruthy();
      expect(queued.data.priorityWeight).toBe(2);

      // Dedupe check
      const dupe = await services.router.call("POST /messaging/queue", {
        auth: { token },
        recipientUserId: "student_1",
        title: "Alert",
        body: "Something happened",
        priority: "normal",
      });
      expect(dupe.status).toBe(202);
      expect(dupe.data.skipped).toBe(true);
      expect(dupe.data.reason).toBe("duplicate_within_60s");
      expect(dupe.data.duplicateId).toBe(queued.data._id);

      // Deliver
      const delivered = await services.router.call(
        "POST /messaging/deliver-next",
        {
          auth: { token },
          recipientUserId: "student_1",
        },
      );
      expect(delivered.status).toBe(200);
      expect(delivered.data.status).toBe("delivered");
      expect(delivered.data.deliveredAt).toBeTruthy();
      expect(delivered.data._id).toBe(queued.data._id);

      // Verify receipt exists in DB
      const receipts = await services.router.call("GET /messaging/receipts", {
        auth: { token },
        recipientUserId: "student_1",
      });
      expect(receipts.status).toBe(200);
      expect(receipts.data.length).toBe(1);
      expect(receipts.data[0].notificationId).toBe(queued.data._id);
      expect(receipts.data[0].status).toBe("delivered");
      expect(receipts.data[0].recipientUserId).toBe("student_1");
    });
  });

  // ── RBAC boundary — verify response body for each role ──

  describe("RBAC boundary response bodies", () => {
    it("warehouse staff can assign carrier and response includes carrier data", async () => {
      const shipment = await services.db.collections.shipments.insertOne({
        itemSku: "SKU-RBAC",
        requester: "student_1",
        date: new Date().toISOString(),
      });

      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call(
        "POST /fulfillment/assign-carrier",
        {
          auth: { token },
          actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
          shipmentId: shipment._id,
          carrier: "DHL",
          trackingNumber: "DHL-999",
        },
      );

      expect(result.status).toBe(200);
      expect(result.data.carrier).toBe("DHL");
      expect(result.data.trackingNumber).toBe("DHL-999");
      expect(result.data.documentStatus).toBe("in_transit");
      expect(result.data.shippedAt).toBeTruthy();
    });

    it("admin audit verify-chain returns valid flag and total", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("GET /audit/verify-chain", {
        auth: { token },
      });

      // verifyChain may return raw {valid,total,issues} or wrapped {status,data}
      const data = result.data ?? result;
      expect(data.valid).toBe(true);
      expect(typeof data.total).toBe("number");
      expect(data.issues).toEqual([]);
    });
  });

  // ── 404 route — verify error shape ──

  describe("unknown route error", () => {
    it("returns 404 with structured error for unknown route", async () => {
      const result = await services.router.call("GET /nonexistent", {});

      expect(result.status).toBe(404);
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.error.message).toContain("Route not found");
    });
  });
});

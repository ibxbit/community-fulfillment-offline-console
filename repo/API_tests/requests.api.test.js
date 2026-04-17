import { beforeEach, describe, expect, it } from "vitest";
import { ROLES } from "../src/auth/roles";
import { REQUEST_STATUS } from "../src/services/requestLifecycleService";
import {
  createApiTestContext,
  clearAll,
  seedAllUsers,
  loginAs,
} from "./apiTestHelpers";

describe("Request and review route coverage", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createApiTestContext());
    await clearAll(services);
    await seedAllUsers(services);
  });

  async function createAndSubmitRequest(studentToken) {
    const created = await services.router.call("POST /requests/draft", {
      auth: { token: studentToken },
      actor: { userId: "student_1", role: ROLES.STUDENT },
      data: {
        requestingOrgId: "org_a",
        requestingClassId: "class_a",
        itemSku: "SKU-TEST",
        quantity: 3,
      },
    });
    expect(created.status).toBe(201);

    const submitted = await services.router.call("POST /requests/submit", {
      auth: { token: studentToken },
      actor: { userId: "student_1", role: ROLES.STUDENT },
      requestId: created.data._id,
    });
    expect(submitted.status).toBe(200);

    return created.data._id;
  }

  // ── GET /requests ──

  describe("GET /requests", () => {
    it("returns an empty list when no requests exist", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("GET /requests", {
        auth: { token },
      });

      expect(result.status).toBe(200);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(0);
    });

    it("returns requests after creation", async () => {
      const token = await loginAs(services, "student1");

      await services.router.call("POST /requests/draft", {
        auth: { token },
        actor: { userId: "student_1", role: ROLES.STUDENT },
        data: {
          requestingOrgId: "org_a",
          requestingClassId: "class_a",
          itemSku: "SKU-LIST",
          quantity: 1,
        },
      });

      const result = await services.router.call("GET /requests", {
        auth: { token },
      });

      expect(result.status).toBe(200);
      expect(result.data.length).toBe(1);
      expect(result.data[0].itemSku).toBe("SKU-LIST");
      expect(result.data[0].status).toBe(REQUEST_STATUS.DRAFT);
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call("GET /requests", {});
      expect(result.status).toBe(401);
    });

    it("rejects unauthorized role (finance has no requests:read)", async () => {
      const token = await loginAs(services, "finance1");
      const result = await services.router.call("GET /requests", {
        auth: { token },
      });
      expect(result.status).toBe(403);
    });
  });

  // ── POST /requests/draft — deeper assertions ──

  describe("POST /requests/draft (deeper)", () => {
    it("returns full request body with status history", async () => {
      const token = await loginAs(services, "student1");

      const result = await services.router.call("POST /requests/draft", {
        auth: { token },
        actor: { userId: "student_1", role: ROLES.STUDENT },
        data: {
          requestingOrgId: "org_a",
          requestingClassId: "class_a",
          itemSku: "SKU-DEEP",
          quantity: 5,
        },
      });

      expect(result.status).toBe(201);
      expect(result.data.status).toBe(REQUEST_STATUS.DRAFT);
      expect(result.data.ownerUserId).toBe("student_1");
      expect(result.data.statusHistory).toBeTruthy();
      expect(result.data.statusHistory.length).toBe(1);
      expect(result.data.statusHistory[0].to).toBe(REQUEST_STATUS.DRAFT);
      expect(result.data.actionLog.length).toBe(1);
      expect(result.data.timestamps.draftedAt).toBeTruthy();
    });

    it("rejects missing required fields", async () => {
      const token = await loginAs(services, "student1");

      const result = await services.router.call("POST /requests/draft", {
        auth: { token },
        actor: { userId: "student_1", role: ROLES.STUDENT },
        data: { requestingOrgId: "org_a" },
      });

      expect(result.status).toBe(400);
      expect(result.error.message).toContain("required");
    });
  });

  // ── POST /requests/submit — deeper assertions ──

  describe("POST /requests/submit (deeper)", () => {
    it("transitions to review status with history", async () => {
      const token = await loginAs(services, "student1");

      const created = await services.router.call("POST /requests/draft", {
        auth: { token },
        actor: { userId: "student_1", role: ROLES.STUDENT },
        data: {
          requestingOrgId: "org_a",
          requestingClassId: "class_a",
          itemSku: "SKU-SUBMIT",
          quantity: 1,
        },
      });

      const submitted = await services.router.call("POST /requests/submit", {
        auth: { token },
        actor: { userId: "student_1", role: ROLES.STUDENT },
        requestId: created.data._id,
      });

      expect(submitted.status).toBe(200);
      expect(submitted.data.status).toBe(REQUEST_STATUS.REVIEW);
      expect(submitted.data.reviewCycle).toBe(1);
      expect(submitted.data.timestamps.submittedAt).toBeTruthy();
    });
  });

  // ── POST /requests/review/return ──

  describe("POST /requests/review/return", () => {
    it("returns a request with comments and transitions status", async () => {
      const studentToken = await loginAs(services, "student1");
      const requestId = await createAndSubmitRequest(studentToken);

      const reviewerToken = await loginAs(services, "reviewer1");
      const result = await services.router.call(
        "POST /requests/review/return",
        {
          auth: { token: reviewerToken },
          actor: { userId: "reviewer_1", role: ROLES.REVIEWER },
          requestId,
          comment: "Needs more details",
        },
      );

      expect(result.status).toBe(200);
      expect(result.data.status).toBe(REQUEST_STATUS.RETURNED);
      expect(result.data.fulfillmentBlocked).toBe(true);
      expect(result.data.reviewComment).toBe("Needs more details");
      expect(result.data.timestamps.returnedAt).toBeTruthy();
      expect(result.data.reviewHistory.length).toBeGreaterThan(0);
    });

    it("rejects return without comment", async () => {
      const studentToken = await loginAs(services, "student1");
      const requestId = await createAndSubmitRequest(studentToken);

      const reviewerToken = await loginAs(services, "reviewer1");
      const result = await services.router.call(
        "POST /requests/review/return",
        {
          auth: { token: reviewerToken },
          actor: { userId: "reviewer_1", role: ROLES.REVIEWER },
          requestId,
          comment: "",
        },
      );

      expect(result.status).toBe(400);
      expect(result.error.message).toContain("comment");
    });

    it("rejects unauthenticated return", async () => {
      const result = await services.router.call(
        "POST /requests/review/return",
        { requestId: "some_id", comment: "text" },
      );
      expect(result.status).toBe(401);
    });

    it("rejects non-reviewer role", async () => {
      const studentToken = await loginAs(services, "student1");
      const requestId = await createAndSubmitRequest(studentToken);

      const result = await services.router.call(
        "POST /requests/review/return",
        {
          auth: { token: studentToken },
          actor: { userId: "student_1", role: ROLES.STUDENT },
          requestId,
          comment: "I want to return this",
        },
      );

      expect(result.status).toBe(403);
    });
  });

  // ── POST /requests/review/comment ──

  describe("POST /requests/review/comment", () => {
    it("adds a comment to a request and persists it", async () => {
      const studentToken = await loginAs(services, "student1");
      const requestId = await createAndSubmitRequest(studentToken);

      const reviewerToken = await loginAs(services, "reviewer1");
      const result = await services.router.call(
        "POST /requests/review/comment",
        {
          auth: { token: reviewerToken },
          actor: { userId: "reviewer_1", role: ROLES.REVIEWER },
          requestId,
          comment: "This looks good overall",
        },
      );

      expect(result.status).toBe(200);
      expect(result.data.reviewHistory.length).toBeGreaterThan(0);
      const lastReview =
        result.data.reviewHistory[result.data.reviewHistory.length - 1];
      expect(lastReview.action).toBe("review_comment");
      expect(lastReview.comment).toBe("This looks good overall");
    });

    it("rejects empty comment", async () => {
      const studentToken = await loginAs(services, "student1");
      const requestId = await createAndSubmitRequest(studentToken);

      const reviewerToken = await loginAs(services, "reviewer1");
      const result = await services.router.call(
        "POST /requests/review/comment",
        {
          auth: { token: reviewerToken },
          actor: { userId: "reviewer_1", role: ROLES.REVIEWER },
          requestId,
          comment: "   ",
        },
      );

      expect(result.status).toBe(400);
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call(
        "POST /requests/review/comment",
        { requestId: "id", comment: "text" },
      );
      expect(result.status).toBe(401);
    });

    it("rejects non-reviewer/admin role", async () => {
      const studentToken = await loginAs(services, "student1");
      const requestId = await createAndSubmitRequest(studentToken);

      const warehouseToken = await loginAs(services, "warehouse1");
      const result = await services.router.call(
        "POST /requests/review/comment",
        {
          auth: { token: warehouseToken },
          actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
          requestId,
          comment: "hello",
        },
      );

      expect(result.status).toBe(403);
    });
  });

  // ── POST /requests/review/exception ──

  describe("POST /requests/review/exception", () => {
    it("attaches exception reason to a request", async () => {
      const studentToken = await loginAs(services, "student1");
      const requestId = await createAndSubmitRequest(studentToken);

      const reviewerToken = await loginAs(services, "reviewer1");
      const result = await services.router.call(
        "POST /requests/review/exception",
        {
          auth: { token: reviewerToken },
          actor: { userId: "reviewer_1", role: ROLES.REVIEWER },
          requestId,
          reason: "Exceeds budget threshold",
        },
      );

      expect(result.status).toBe(200);
      expect(result.data.exceptionReasons).toContain(
        "Exceeds budget threshold",
      );
      expect(result.data.reviewHistory.length).toBeGreaterThan(0);
      const lastReview =
        result.data.reviewHistory[result.data.reviewHistory.length - 1];
      expect(lastReview.action).toBe("review_exception");
      expect(lastReview.exceptionReason).toBe("Exceeds budget threshold");
    });

    it("rejects empty reason", async () => {
      const studentToken = await loginAs(services, "student1");
      const requestId = await createAndSubmitRequest(studentToken);

      const reviewerToken = await loginAs(services, "reviewer1");
      const result = await services.router.call(
        "POST /requests/review/exception",
        {
          auth: { token: reviewerToken },
          actor: { userId: "reviewer_1", role: ROLES.REVIEWER },
          requestId,
          reason: "",
        },
      );

      expect(result.status).toBe(400);
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call(
        "POST /requests/review/exception",
        { requestId: "id", reason: "reason" },
      );
      expect(result.status).toBe(401);
    });

    it("rejects non-reviewer role", async () => {
      const studentToken = await loginAs(services, "student1");
      const requestId = await createAndSubmitRequest(studentToken);

      const financeToken = await loginAs(services, "finance1");
      const result = await services.router.call(
        "POST /requests/review/exception",
        {
          auth: { token: financeToken },
          actor: { userId: "finance_1", role: ROLES.FINANCE },
          requestId,
          reason: "Budget concern",
        },
      );

      expect(result.status).toBe(403);
    });
  });

  // ── POST /requests/review/approve — deeper ──

  describe("POST /requests/review/approve (deeper)", () => {
    it("transitions to approved and records review history", async () => {
      const studentToken = await loginAs(services, "student1");
      const requestId = await createAndSubmitRequest(studentToken);

      const reviewerToken = await loginAs(services, "reviewer1");
      const result = await services.router.call(
        "POST /requests/review/approve",
        {
          auth: { token: reviewerToken },
          actor: { userId: "reviewer_1", role: ROLES.REVIEWER },
          requestId,
          comment: "Approved with conditions",
        },
      );

      expect(result.status).toBe(200);
      expect(result.data.status).toBe(REQUEST_STATUS.APPROVED);
      expect(result.data.reviewedByUserId).toBe("reviewer_1");
      expect(result.data.reviewComment).toBe("Approved with conditions");
      expect(result.data.timestamps.approvedAt).toBeTruthy();
      expect(result.data.fulfillmentBlocked).toBe(false);
    });

    it("rejects approval of non-review status request", async () => {
      const studentToken = await loginAs(services, "student1");
      const created = await services.router.call("POST /requests/draft", {
        auth: { token: studentToken },
        actor: { userId: "student_1", role: ROLES.STUDENT },
        data: {
          requestingOrgId: "org_a",
          requestingClassId: "class_a",
          itemSku: "SKU-X",
          quantity: 1,
        },
      });

      const reviewerToken = await loginAs(services, "reviewer1");
      const result = await services.router.call(
        "POST /requests/review/approve",
        {
          auth: { token: reviewerToken },
          actor: { userId: "reviewer_1", role: ROLES.REVIEWER },
          requestId: created.data._id,
          comment: "ok",
        },
      );

      expect(result.status).toBe(409);
    });
  });

  // ── POST /requests/archive — deeper ──

  describe("POST /requests/archive (deeper)", () => {
    it("archives an approved request with full body assertions", async () => {
      const studentToken = await loginAs(services, "student1");
      const requestId = await createAndSubmitRequest(studentToken);

      const reviewerToken = await loginAs(services, "reviewer1");
      await services.router.call("POST /requests/review/approve", {
        auth: { token: reviewerToken },
        actor: { userId: "reviewer_1", role: ROLES.REVIEWER },
        requestId,
        comment: "ok",
      });

      const token2 = await loginAs(services, "student1");
      const result = await services.router.call("POST /requests/archive", {
        auth: { token: token2 },
        actor: { userId: "student_1", role: ROLES.STUDENT },
        requestId,
      });

      expect(result.status).toBe(200);
      expect(result.data.status).toBe(REQUEST_STATUS.ARCHIVED);
      expect(result.data.timestamps.archivedAt).toBeTruthy();
      expect(result.data.fulfillmentBlocked).toBe(true);
    });

    it("rejects archiving a draft-status request", async () => {
      const token = await loginAs(services, "student1");
      const created = await services.router.call("POST /requests/draft", {
        auth: { token },
        actor: { userId: "student_1", role: ROLES.STUDENT },
        data: {
          requestingOrgId: "org_a",
          requestingClassId: "class_a",
          itemSku: "SKU-ARC",
          quantity: 1,
        },
      });

      const result = await services.router.call("POST /requests/archive", {
        auth: { token },
        actor: { userId: "student_1", role: ROLES.STUDENT },
        requestId: created.data._id,
      });

      expect(result.status).toBe(409);
    });
  });

  // ── GET /fulfillments ──

  describe("GET /fulfillments", () => {
    it("returns list for authorized user", async () => {
      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call("GET /fulfillments", {
        auth: { token },
      });
      expect(result.status).toBe(200);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call("GET /fulfillments", {});
      expect(result.status).toBe(401);
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("GET /fulfillments", {
        auth: { token },
      });
      expect(result.status).toBe(403);
    });
  });

  // ── POST /fulfillments ──

  describe("POST /fulfillments", () => {
    it("creates a fulfillment record for authorized user", async () => {
      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call("POST /fulfillments", {
        auth: { token },
        itemSku: "SKU-F1",
        quantity: 5,
      });

      expect(result.status).toBe(201);
      expect(result.data.itemSku).toBe("SKU-F1");
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call("POST /fulfillments", {
        itemSku: "SKU-X",
      });
      expect(result.status).toBe(401);
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("POST /fulfillments", {
        auth: { token },
        itemSku: "SKU-X",
      });
      expect(result.status).toBe(403);
    });
  });
});

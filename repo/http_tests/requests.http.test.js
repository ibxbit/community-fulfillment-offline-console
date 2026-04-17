import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestServer,
  seedAllUsers,
  clearAll,
  httpLogin,
  httpRequest,
} from "./testHttpServer.js";

describe("Requests & Review HTTP integration tests", () => {
  let ctx, base;

  beforeAll(async () => {
    ctx = await createTestServer();
    await ctx.start();
    base = ctx.baseUrl();
  });

  afterAll(async () => { await ctx.stop(); });

  beforeEach(async () => {
    await clearAll(ctx.services);
    await seedAllUsers(ctx.services);
  });

  async function draftAndSubmit(token) {
    const draft = await httpRequest(base, "POST", "/requests/draft", {
      actor: { userId: "student_1", role: "Student" },
      data: {
        requestingOrgId: "org_a",
        requestingClassId: "class_a",
        itemSku: "SKU-HTTP",
        quantity: 2,
      },
    }, token);
    expect(draft.httpStatus).toBe(201);

    const submitted = await httpRequest(base, "POST", "/requests/submit", {
      actor: { userId: "student_1", role: "Student" },
      requestId: draft.data._id,
    }, token);
    expect(submitted.httpStatus).toBe(200);

    return draft.data._id;
  }

  // ── GET /requests ──

  describe("GET /requests", () => {
    it("200 — returns list", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "GET", "/requests", null, token);
      expect(res.httpStatus).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it("401 — unauthenticated", async () => {
      const res = await httpRequest(base, "GET", "/requests");
      expect(res.httpStatus).toBe(401);
    });

    it("403 — finance denied", async () => {
      const token = await httpLogin(base, "finance1");
      const res = await httpRequest(base, "GET", "/requests", null, token);
      expect(res.httpStatus).toBe(403);
    });
  });

  // ── POST /requests/draft ──

  describe("POST /requests/draft", () => {
    it("201 — creates draft with full body", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/requests/draft", {
        actor: { userId: "student_1", role: "Student" },
        data: {
          requestingOrgId: "org_a",
          requestingClassId: "class_a",
          itemSku: "SKU-DRAFT",
          quantity: 1,
        },
      }, token);

      expect(res.httpStatus).toBe(201);
      expect(res.data.status).toBe("draft");
      expect(res.data.ownerUserId).toBe("student_1");
      expect(res.data.itemSku).toBe("SKU-DRAFT");
      expect(res.data.statusHistory).toHaveLength(1);
    });

    it("400 — missing required fields", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/requests/draft", {
        actor: { userId: "student_1", role: "Student" },
        data: { requestingOrgId: "org_a" },
      }, token);
      expect(res.httpStatus).toBe(400);
      expect(res.error.message).toContain("required");
    });

    it("403 — reviewer cannot create", async () => {
      const token = await httpLogin(base, "reviewer1");
      const res = await httpRequest(base, "POST", "/requests/draft", {
        actor: { userId: "reviewer_1", role: "Reviewer" },
        data: { requestingOrgId: "org_a", requestingClassId: "c", itemSku: "X", quantity: 1 },
      }, token);
      expect(res.httpStatus).toBe(403);
    });
  });

  // ── PATCH /requests/draft ──

  describe("PATCH /requests/draft", () => {
    it("200 — updates draft", async () => {
      const token = await httpLogin(base, "student1");
      const draft = await httpRequest(base, "POST", "/requests/draft", {
        actor: { userId: "student_1", role: "Student" },
        data: { requestingOrgId: "org_a", requestingClassId: "class_a", itemSku: "SKU-U", quantity: 1 },
      }, token);

      const res = await httpRequest(base, "PATCH", "/requests/draft", {
        actor: { userId: "student_1", role: "Student" },
        requestId: draft.data._id,
        patch: { quantity: 10 },
      }, token);

      expect(res.httpStatus).toBe(200);
      expect(res.data.quantity).toBe(10);
    });
  });

  // ── POST /requests/submit ──

  describe("POST /requests/submit", () => {
    it("200 — transitions to review", async () => {
      const token = await httpLogin(base, "student1");
      const draft = await httpRequest(base, "POST", "/requests/draft", {
        actor: { userId: "student_1", role: "Student" },
        data: { requestingOrgId: "org_a", requestingClassId: "class_a", itemSku: "SKU-S", quantity: 1 },
      }, token);

      const res = await httpRequest(base, "POST", "/requests/submit", {
        actor: { userId: "student_1", role: "Student" },
        requestId: draft.data._id,
      }, token);

      expect(res.httpStatus).toBe(200);
      expect(res.data.status).toBe("review");
      expect(res.data.reviewCycle).toBe(1);
    });
  });

  // ── POST /requests/review/approve ──

  describe("POST /requests/review/approve", () => {
    it("200 — approves and returns full body", async () => {
      const studentToken = await httpLogin(base, "student1");
      const requestId = await draftAndSubmit(studentToken);

      const reviewerToken = await httpLogin(base, "reviewer1");
      const res = await httpRequest(base, "POST", "/requests/review/approve", {
        actor: { userId: "reviewer_1", role: "Reviewer" },
        requestId,
        comment: "approved via HTTP",
      }, reviewerToken);

      expect(res.httpStatus).toBe(200);
      expect(res.data.status).toBe("approved");
      expect(res.data.reviewedByUserId).toBe("reviewer_1");
      expect(res.data.timestamps.approvedAt).toBeTruthy();
    });

    it("409 — cannot approve draft", async () => {
      const token = await httpLogin(base, "student1");
      const draft = await httpRequest(base, "POST", "/requests/draft", {
        actor: { userId: "student_1", role: "Student" },
        data: { requestingOrgId: "org_a", requestingClassId: "class_a", itemSku: "X", quantity: 1 },
      }, token);

      const reviewerToken = await httpLogin(base, "reviewer1");
      const res = await httpRequest(base, "POST", "/requests/review/approve", {
        actor: { userId: "reviewer_1", role: "Reviewer" },
        requestId: draft.data._id,
        comment: "ok",
      }, reviewerToken);

      expect(res.httpStatus).toBe(409);
    });
  });

  // ── POST /requests/review/return ──

  describe("POST /requests/review/return", () => {
    it("200 — returns request with comment", async () => {
      const studentToken = await httpLogin(base, "student1");
      const requestId = await draftAndSubmit(studentToken);

      const reviewerToken = await httpLogin(base, "reviewer1");
      const res = await httpRequest(base, "POST", "/requests/review/return", {
        actor: { userId: "reviewer_1", role: "Reviewer" },
        requestId,
        comment: "needs revision",
      }, reviewerToken);

      expect(res.httpStatus).toBe(200);
      expect(res.data.status).toBe("return");
      expect(res.data.reviewComment).toBe("needs revision");
    });

    it("400 — empty comment", async () => {
      const studentToken = await httpLogin(base, "student1");
      const requestId = await draftAndSubmit(studentToken);

      const reviewerToken = await httpLogin(base, "reviewer1");
      const res = await httpRequest(base, "POST", "/requests/review/return", {
        actor: { userId: "reviewer_1", role: "Reviewer" },
        requestId, comment: "",
      }, reviewerToken);

      expect(res.httpStatus).toBe(400);
    });
  });

  // ── POST /requests/review/comment ──

  describe("POST /requests/review/comment", () => {
    it("200 — adds comment to review history", async () => {
      const studentToken = await httpLogin(base, "student1");
      const requestId = await draftAndSubmit(studentToken);

      const reviewerToken = await httpLogin(base, "reviewer1");
      const res = await httpRequest(base, "POST", "/requests/review/comment", {
        actor: { userId: "reviewer_1", role: "Reviewer" },
        requestId, comment: "looks promising",
      }, reviewerToken);

      expect(res.httpStatus).toBe(200);
      expect(res.data.reviewHistory.length).toBeGreaterThan(0);
    });

    it("400 — empty comment", async () => {
      const studentToken = await httpLogin(base, "student1");
      const requestId = await draftAndSubmit(studentToken);

      const reviewerToken = await httpLogin(base, "reviewer1");
      const res = await httpRequest(base, "POST", "/requests/review/comment", {
        actor: { userId: "reviewer_1", role: "Reviewer" },
        requestId, comment: "   ",
      }, reviewerToken);

      expect(res.httpStatus).toBe(400);
    });
  });

  // ── POST /requests/review/exception ──

  describe("POST /requests/review/exception", () => {
    it("200 — attaches exception reason", async () => {
      const studentToken = await httpLogin(base, "student1");
      const requestId = await draftAndSubmit(studentToken);

      const reviewerToken = await httpLogin(base, "reviewer1");
      const res = await httpRequest(base, "POST", "/requests/review/exception", {
        actor: { userId: "reviewer_1", role: "Reviewer" },
        requestId, reason: "Budget exceeded",
      }, reviewerToken);

      expect(res.httpStatus).toBe(200);
      expect(res.data.exceptionReasons).toContain("Budget exceeded");
    });

    it("400 — empty reason", async () => {
      const studentToken = await httpLogin(base, "student1");
      const requestId = await draftAndSubmit(studentToken);

      const reviewerToken = await httpLogin(base, "reviewer1");
      const res = await httpRequest(base, "POST", "/requests/review/exception", {
        actor: { userId: "reviewer_1", role: "Reviewer" },
        requestId, reason: "",
      }, reviewerToken);

      expect(res.httpStatus).toBe(400);
    });
  });

  // ── POST /requests/archive ──

  describe("POST /requests/archive", () => {
    it("200 — archives approved request", async () => {
      const studentToken = await httpLogin(base, "student1");
      const requestId = await draftAndSubmit(studentToken);

      const reviewerToken = await httpLogin(base, "reviewer1");
      await httpRequest(base, "POST", "/requests/review/approve", {
        actor: { userId: "reviewer_1", role: "Reviewer" },
        requestId, comment: "ok",
      }, reviewerToken);

      const newToken = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/requests/archive", {
        actor: { userId: "student_1", role: "Student" },
        requestId,
      }, newToken);

      expect(res.httpStatus).toBe(200);
      expect(res.data.status).toBe("archive");
      expect(res.data.timestamps.archivedAt).toBeTruthy();
    });

    it("409 — cannot archive draft", async () => {
      const token = await httpLogin(base, "student1");
      const draft = await httpRequest(base, "POST", "/requests/draft", {
        actor: { userId: "student_1", role: "Student" },
        data: { requestingOrgId: "org_a", requestingClassId: "class_a", itemSku: "X", quantity: 1 },
      }, token);

      const res = await httpRequest(base, "POST", "/requests/archive", {
        actor: { userId: "student_1", role: "Student" },
        requestId: draft.data._id,
      }, token);

      expect(res.httpStatus).toBe(409);
    });
  });
});

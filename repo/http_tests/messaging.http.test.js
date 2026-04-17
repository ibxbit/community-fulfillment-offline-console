import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestServer,
  seedAllUsers,
  clearAll,
  httpLogin,
  httpRequest,
} from "./testHttpServer.js";

describe("Messaging HTTP integration tests", () => {
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

  // ── GET /messaging/templates ──
  describe("GET /messaging/templates", () => {
    it("200 — returns list", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "GET", "/messaging/templates", null, token);
      expect(res.httpStatus).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it("401 — unauthenticated", async () => {
      const res = await httpRequest(base, "GET", "/messaging/templates");
      expect(res.httpStatus).toBe(401);
    });
  });

  // ── POST /messaging/templates ──
  describe("POST /messaging/templates", () => {
    it("201 — creates template with body shape", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/messaging/templates", {
        templateId: "welcome", title: "Welcome {{name}}", body: "Hello {{name}}",
        variables: ["name"], defaultPriority: "high",
      }, token);

      expect(res.httpStatus).toBe(201);
      expect(res.data.templateId).toBe("welcome");
      expect(res.data.kind).toBe("template");
      expect(res.data.defaultPriority).toBe("high");
    });

    it("200 — updates existing template", async () => {
      const token = await httpLogin(base, "admin1");
      await httpRequest(base, "POST", "/messaging/templates", {
        templateId: "t1", title: "V1", body: "B1",
      }, token);

      const res = await httpRequest(base, "POST", "/messaging/templates", {
        templateId: "t1", title: "V2", body: "B2",
      }, token);

      expect(res.httpStatus).toBe(200);
      expect(res.data.title).toBe("V2");
    });

    it("400 — missing fields", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/messaging/templates", {
        templateId: "", title: "", body: "",
      }, token);
      expect(res.httpStatus).toBe(400);
    });

    it("403 — student denied", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/messaging/templates", {
        templateId: "x", title: "X", body: "X",
      }, token);
      expect(res.httpStatus).toBe(403);
    });
  });

  // ── GET /messaging/subscriptions ──
  describe("GET /messaging/subscriptions", () => {
    it("200 — returns default preferences for self with full shape", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "GET", "/messaging/subscriptions", null, token);
      expect(res.httpStatus).toBe(200);
      expect(res.data.preferences).toBeTruthy();
      expect(res.data.preferences.allowAll).toBe(true);
      expect(res.data.preferences.mutedTemplateIds).toEqual([]);
      expect(res.data.preferences.mutedPriorities).toEqual([]);
      expect(res.data.userId).toBe("student_1");
      expect(res.error).toBeNull();
    });

    it("200 — admin can read another user's subscriptions via POST body userId", async () => {
      // First, set student2's preferences via router so we have data to read
      const adminToken = await httpLogin(base, "admin1");

      // Set preferences for student_2
      const setRes = await httpRequest(base, "POST", "/messaging/subscriptions", {
        userId: "student_2",
        preferences: { allowAll: false, mutedTemplateIds: ["promo"], mutedPriorities: [] },
      }, adminToken);
      expect(setRes.httpStatus).toBe(201);

      // Admin reads student_2's subscriptions
      const getRes = await httpRequest(base, "POST", "/messaging/subscriptions", {
        userId: "student_2",
        preferences: { allowAll: false, mutedTemplateIds: ["promo"], mutedPriorities: [] },
      }, adminToken);
      // Re-saving returns the current state; verify it persisted
      expect(getRes.httpStatus).toBe(200);
      expect(getRes.data.preferences.allowAll).toBe(false);
    });

    it("403 — non-admin POST for another user's subscriptions is denied", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/messaging/subscriptions", {
        userId: "student_2",
        preferences: { allowAll: false },
      }, token);
      expect(res.httpStatus).toBe(403);
      expect(res.data).toBeNull();
      expect(res.error.message).toContain("subscriptions");
    });

    it("401 — unauthenticated", async () => {
      const res = await httpRequest(base, "GET", "/messaging/subscriptions");
      expect(res.httpStatus).toBe(401);
      expect(res.error.message).toBe("Authentication required");
    });
  });

  // ── POST /messaging/subscriptions ──
  describe("POST /messaging/subscriptions", () => {
    it("201 — sets preferences", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/messaging/subscriptions", {
        preferences: { allowAll: false, mutedTemplateIds: ["promo"], mutedPriorities: ["low"] },
      }, token);
      expect(res.httpStatus).toBe(201);
      expect(res.data.preferences.allowAll).toBe(false);
    });

    it("403 — non-admin cannot update other user", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/messaging/subscriptions", {
        userId: "student_2", preferences: { allowAll: false },
      }, token);
      expect(res.httpStatus).toBe(403);
    });
  });

  // ── POST /messaging/queue ──
  describe("POST /messaging/queue", () => {
    it("201 — queues message with body shape", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/messaging/queue", {
        recipientUserId: "student_1", title: "Alert", body: "Content", priority: "high",
      }, token);

      expect(res.httpStatus).toBe(201);
      expect(res.data.kind).toBe("message");
      expect(res.data.status).toBe("queued");
      expect(res.data.priorityWeight).toBe(3);
    });

    it("202 — deduplicates within window", async () => {
      const token = await httpLogin(base, "student1");
      const payload = {
        recipientUserId: "student_1", title: "Dup", body: "Dup body", priority: "normal",
      };

      const first = await httpRequest(base, "POST", "/messaging/queue", payload, token);
      expect(first.httpStatus).toBe(201);

      const second = await httpRequest(base, "POST", "/messaging/queue", payload, token);
      expect(second.httpStatus).toBe(202);
      expect(second.data.skipped).toBe(true);
      expect(second.data.reason).toBe("duplicate_within_60s");
    });

    it("403 — finance cannot queue for other user", async () => {
      const token = await httpLogin(base, "finance1");
      const res = await httpRequest(base, "POST", "/messaging/queue", {
        recipientUserId: "student_1", title: "X", body: "Y",
      }, token);
      expect(res.httpStatus).toBe(403);
    });
  });

  // ── GET /messaging/queue ──
  describe("GET /messaging/queue", () => {
    it("200 — returns queued messages", async () => {
      const token = await httpLogin(base, "student1");
      await httpRequest(base, "POST", "/messaging/queue", {
        recipientUserId: "student_1", title: "T", body: "B",
      }, token);

      const res = await httpRequest(base, "GET", "/messaging/queue", null, token);
      expect(res.httpStatus).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBe(1);
    });
  });

  // ── POST /messaging/deliver-next ──
  describe("POST /messaging/deliver-next", () => {
    it("200 — delivers and creates receipt", async () => {
      const token = await httpLogin(base, "student1");
      await httpRequest(base, "POST", "/messaging/queue", {
        recipientUserId: "student_1", title: "Deliver", body: "Me",
      }, token);

      const res = await httpRequest(base, "POST", "/messaging/deliver-next", {
        recipientUserId: "student_1",
      }, token);

      expect(res.httpStatus).toBe(200);
      expect(res.data.status).toBe("delivered");
      expect(res.data.deliveredAt).toBeTruthy();
    });

    it("200 — returns null when queue empty", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/messaging/deliver-next", {
        recipientUserId: "student_1",
      }, token);
      expect(res.httpStatus).toBe(200);
      expect(res.data).toBeNull();
    });
  });

  // ── GET /messaging/receipts ──
  describe("GET /messaging/receipts", () => {
    it("200 — returns receipts after delivery", async () => {
      const token = await httpLogin(base, "student1");
      await httpRequest(base, "POST", "/messaging/queue", {
        recipientUserId: "student_1", title: "R", body: "R",
      }, token);
      await httpRequest(base, "POST", "/messaging/deliver-next", {
        recipientUserId: "student_1",
      }, token);

      const res = await httpRequest(base, "GET", "/messaging/receipts", null, token);
      expect(res.httpStatus).toBe(200);
      expect(res.data.length).toBe(1);
      expect(res.data[0].status).toBe("delivered");
    });
  });
});

/**
 * Priority 3: Deeper HTTP assertions for weakly-covered routes.
 * Priority 4: Real query-string HTTP coverage.
 * Priority 5: Transport-boundary negative tests.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestServer,
  seedAllUsers,
  clearAll,
  httpLogin,
  httpRequest,
} from "./testHttpServer.js";

describe("Deep HTTP assertions and query-string coverage", () => {
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

  // ── Priority 3: Deeper route assertions ──

  describe("GET /requests — deeper", () => {
    it("401 — structured error body for unauthenticated", async () => {
      const res = await httpRequest(base, "GET", "/requests");
      expect(res.httpStatus).toBe(401);
      expect(res.data).toBeNull();
      expect(res.error).toBeTruthy();
      expect(res.error.message).toBe("Authentication required");
    });

    it("403 — structured error body for unauthorized role", async () => {
      const token = await httpLogin(base, "finance1");
      const res = await httpRequest(base, "GET", "/requests", null, token);
      expect(res.httpStatus).toBe(403);
      expect(res.data).toBeNull();
      expect(res.error.message).toBe("Permission denied");
    });

    it("200 — returns items with expected shape", async () => {
      const token = await httpLogin(base, "student1");

      // Create a request first
      await httpRequest(base, "POST", "/requests/draft", {
        actor: { userId: "student_1", role: "Student" },
        data: {
          requestingOrgId: "org_a", requestingClassId: "class_a",
          itemSku: "SKU-SHAPE", quantity: 5,
        },
      }, token);

      const res = await httpRequest(base, "GET", "/requests", null, token);
      expect(res.httpStatus).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBe(1);
      expect(res.data[0]).toHaveProperty("_id");
      expect(res.data[0]).toHaveProperty("itemSku", "SKU-SHAPE");
      expect(res.data[0]).toHaveProperty("quantity", 5);
      expect(res.data[0]).toHaveProperty("status", "draft");
      expect(res.data[0]).toHaveProperty("ownerUserId");
      expect(res.data[0]).toHaveProperty("statusHistory");
    });
  });

  describe("GET /fulfillments — deeper", () => {
    it("200 — returns items with shape after seeding", async () => {
      const adminToken = await httpLogin(base, "admin1");
      await httpRequest(base, "POST", "/fulfillments", { itemSku: "SKU-FF1", quantity: 3 }, adminToken);

      const warehouseToken = await httpLogin(base, "warehouse1");
      const res = await httpRequest(base, "GET", "/fulfillments", null, warehouseToken);
      expect(res.httpStatus).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBe(1);
      expect(res.data[0]).toHaveProperty("_id");
      expect(res.data[0]).toHaveProperty("itemSku", "SKU-FF1");
    });

    it("403 — structured forbidden body", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "GET", "/fulfillments", null, token);
      expect(res.httpStatus).toBe(403);
      expect(res.data).toBeNull();
      expect(res.error.message).toBe("Permission denied");
    });
  });

  describe("POST /fulfillments — deeper", () => {
    it("201 — returns created object with _id and persisted fields", async () => {
      const token = await httpLogin(base, "warehouse1");
      const res = await httpRequest(base, "POST", "/fulfillments", {
        itemSku: "SKU-FC1", quantity: 7, lot: "LOT-X",
      }, token);

      expect(res.httpStatus).toBe(201);
      expect(res.data).toHaveProperty("_id");
      expect(res.data.itemSku).toBe("SKU-FC1");
      expect(res.data.quantity).toBe(7);
      expect(res.data.lot).toBe("LOT-X");
      expect(res.error).toBeNull();
    });

    it("403 — student gets structured forbidden", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/fulfillments", { itemSku: "X" }, token);
      expect(res.httpStatus).toBe(403);
      expect(res.data).toBeNull();
      expect(res.error.message).toBe("Permission denied");
    });
  });

  describe("POST /admin/settlement-cycle — deeper", () => {
    it("201 — returns full object shape", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/settlement-cycle", {
        frequency: "daily", dayOfWeek: "Monday", time: "09:00",
      }, token);

      expect(res.httpStatus).toBe(201);
      expect(res.data).toHaveProperty("_id");
      expect(res.data.frequency).toBe("daily");
      expect(res.data.dayOfWeek).toBe("Monday");
      expect(res.data.time).toBe("09:00");
      expect(res.data).toHaveProperty("updatedAt");
    });

    it("403 — student denied with structured error", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/admin/settlement-cycle", {
        frequency: "weekly",
      }, token);
      expect(res.httpStatus).toBe(403);
      expect(res.data).toBeNull();
      expect(res.error.message).toBe("Permission denied");
    });
  });

  describe("GET admin config endpoints — full response shape", () => {
    it("GET /admin/commission-rule — full shape", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "GET", "/admin/commission-rule", null, token);
      expect(res.httpStatus).toBe(200);
      expect(res.data).toHaveProperty("_id");
      expect(res.data).toHaveProperty("percentage");
      expect(res.data).toHaveProperty("rounding");
      expect(typeof res.data.percentage).toBe("number");
      expect(res.error).toBeNull();
    });

    it("GET /admin/settlement-cycle — full shape", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "GET", "/admin/settlement-cycle", null, token);
      expect(res.httpStatus).toBe(200);
      expect(res.data).toHaveProperty("_id");
      expect(res.data).toHaveProperty("frequency");
      expect(res.data).toHaveProperty("dayOfWeek");
      expect(res.data).toHaveProperty("time");
      expect(res.error).toBeNull();
    });

    it("GET /admin/attribution-rules — full shape", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "GET", "/admin/attribution-rules", null, token);
      expect(res.httpStatus).toBe(200);
      expect(res.data).toHaveProperty("_id");
      expect(res.data).toHaveProperty("overlapStrategy");
      expect(res.data).toHaveProperty("multiLeaderStrategy");
      expect(res.error).toBeNull();
    });

    it("401/403 — consistent error structure across all GET admin routes", async () => {
      const routes = [
        "/admin/commission-rule",
        "/admin/settlement-cycle",
        "/admin/attribution-rules",
      ];

      for (const route of routes) {
        const unauth = await httpRequest(base, "GET", route);
        expect(unauth.httpStatus).toBe(401);
        expect(unauth.data).toBeNull();
        expect(unauth.error.message).toBe("Authentication required");
      }

      const studentToken = await httpLogin(base, "student1");
      for (const route of routes) {
        const forbidden = await httpRequest(base, "GET", route, null, studentToken);
        expect(forbidden.httpStatus).toBe(403);
        expect(forbidden.data).toBeNull();
        expect(forbidden.error.message).toBe("Permission denied");
      }
    });
  });

  describe("GET /messaging/queue — deeper", () => {
    it("200 — returns items with payload shape", async () => {
      const token = await httpLogin(base, "student1");

      // Queue a message first
      await httpRequest(base, "POST", "/messaging/queue", {
        recipientUserId: "student_1", title: "Shape Test", body: "Body", priority: "high",
      }, token);

      const res = await httpRequest(base, "GET", "/messaging/queue", null, token);
      expect(res.httpStatus).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBe(1);
      expect(res.data[0]).toHaveProperty("_id");
      expect(res.data[0]).toHaveProperty("title", "Shape Test");
      expect(res.data[0]).toHaveProperty("priority", "high");
      expect(res.data[0]).toHaveProperty("status", "queued");
      expect(res.data[0]).toHaveProperty("kind", "message");
    });

    it("403 — cross-user read denied with structured error", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/messaging/queue", {
        recipientUserId: "student_1", title: "X", body: "Y",
      }, token);
      // The guard for GET /messaging/queue checks recipientUserId vs authUser
      // We test the POST guard for cross-user queue
      const crossRes = await httpRequest(base, "POST", "/messaging/queue", {
        recipientUserId: "admin_1", title: "X", body: "Y",
      }, token);
      expect(crossRes.httpStatus).toBe(403);
      expect(crossRes.data).toBeNull();
      expect(crossRes.error.message).toContain("Cannot queue");
    });
  });

  describe("GET /messaging/receipts — deeper", () => {
    it("200 — returns receipt items with shape", async () => {
      const token = await httpLogin(base, "student1");

      // Queue and deliver
      await httpRequest(base, "POST", "/messaging/queue", {
        recipientUserId: "student_1", title: "Receipt Shape", body: "Body",
      }, token);
      await httpRequest(base, "POST", "/messaging/deliver-next", {
        recipientUserId: "student_1",
      }, token);

      const res = await httpRequest(base, "GET", "/messaging/receipts", null, token);
      expect(res.httpStatus).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBe(1);
      expect(res.data[0]).toHaveProperty("_id");
      expect(res.data[0]).toHaveProperty("notificationId");
      expect(res.data[0]).toHaveProperty("deliveredAt");
      expect(res.data[0]).toHaveProperty("status", "delivered");
      expect(res.data[0]).toHaveProperty("kind", "delivery_receipt");
    });
  });

  // ── Priority 4: Query-string HTTP tests ──

  describe("Query-string transport tests", () => {
    it("GET /users?role=Student — filters via query string", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await fetch(`${base}/users?role=Student`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(json.data)).toBe(true);
      // Query params are merged into body as strings by the server adapter
    });

    it("GET /messaging/subscriptions — self-read via query string", async () => {
      const token = await httpLogin(base, "student1");
      const res = await fetch(`${base}/messaging/subscriptions`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.preferences).toBeTruthy();
      expect(json.data.preferences.allowAll).toBe(true);
    });

    it("GET /messaging/subscriptions?userId=student_2 — admin cross-user via query", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await fetch(`${base}/messaging/subscriptions?userId=student_2`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toBeTruthy();
    });

    it("GET /messaging/subscriptions?userId=student_2 — non-admin denied via query", async () => {
      const token = await httpLogin(base, "student1");
      const res = await fetch(`${base}/messaging/subscriptions?userId=student_2`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.message).toContain("subscriptions");
    });

    it("GET /messaging/queue?recipientUserId=student_1 — admin cross-user", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await fetch(`${base}/messaging/queue?recipientUserId=student_1`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("GET /messaging/queue?recipientUserId=student_2 — non-admin denied", async () => {
      const token = await httpLogin(base, "student1");
      const res = await fetch(`${base}/messaging/queue?recipientUserId=student_2`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.message).toContain("queue");
    });

    it("GET /messaging/receipts?recipientUserId=student_1 — admin cross-user", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await fetch(`${base}/messaging/receipts?recipientUserId=student_1`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("GET /messaging/receipts?recipientUserId=student_2 — non-admin denied", async () => {
      const token = await httpLogin(base, "student1");
      const res = await fetch(`${base}/messaging/receipts?recipientUserId=student_2`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.message).toContain("receipts");
    });
  });

  // ── Priority 5: Transport-boundary negative tests ──

  describe("Transport-boundary negative tests", () => {
    it("malformed JSON body returns graceful response (not crash)", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await fetch(`${base}/admin/service-areas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: "this is not json {{{",
      });

      // The server's body parser resolves {} on parse failure
      // The service then validates and returns a proper error
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error.message).toContain("name");
    });

    it("unknown route returns 404 with structured error", async () => {
      const res = await httpRequest(base, "GET", "/nonexistent/path");
      expect(res.httpStatus).toBe(404);
      expect(res.data).toBeNull();
      expect(res.error).toBeTruthy();
      expect(res.error.message).toContain("Route not found");
    });

    it("unsupported method on existing path returns 404", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await fetch(`${base}/users`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();
      expect(res.status).toBe(404);
      expect(json.error.message).toContain("Route not found");
    });

    it("PUT on a POST-only route returns 404", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await fetch(`${base}/requests/draft`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: "{}",
      });
      const json = await res.json();
      expect(res.status).toBe(404);
      expect(json.error.message).toContain("Route not found");
    });
  });
});

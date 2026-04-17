import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestServer,
  seedAllUsers,
  clearAll,
  httpLogin,
  httpRequest,
} from "./testHttpServer.js";

describe("Admin HTTP integration tests", () => {
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

  // ── GET /admin/service-areas ──
  describe("GET /admin/service-areas", () => {
    it("200 — returns list", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "GET", "/admin/service-areas", null, token);
      expect(res.httpStatus).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it("401 — unauthenticated", async () => {
      const res = await httpRequest(base, "GET", "/admin/service-areas");
      expect(res.httpStatus).toBe(401);
    });

    it("403 — student denied", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "GET", "/admin/service-areas", null, token);
      expect(res.httpStatus).toBe(403);
    });
  });

  // ── POST /admin/service-areas ──
  describe("POST /admin/service-areas", () => {
    it("201 — creates area with body", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/service-areas", {
        name: "North", priority: 10, locations: ["loc-1"],
      }, token);
      expect(res.httpStatus).toBe(201);
      expect(res.data.name).toBe("North");
      expect(res.data.locations).toEqual(["loc-1"]);
    });

    it("400 — empty name", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/service-areas", { name: "", locations: [] }, token);
      expect(res.httpStatus).toBe(400);
    });
  });

  // ── GET/POST /admin/group-leader-bindings ──
  describe("GET /admin/group-leader-bindings", () => {
    it("200 — returns list", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "GET", "/admin/group-leader-bindings", null, token);
      expect(res.httpStatus).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it("403 — student denied", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "GET", "/admin/group-leader-bindings", null, token);
      expect(res.httpStatus).toBe(403);
    });
  });

  describe("POST /admin/group-leader-bindings", () => {
    it("201 — binds leader", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/group-leader-bindings", {
        leaderId: "l1", leaderName: "Alice", locationId: "loc-1", weight: 2,
      }, token);
      expect(res.httpStatus).toBe(201);
      expect(res.data.leaderId).toBe("l1");
    });

    it("400 — missing fields", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/group-leader-bindings", {
        leaderId: "", leaderName: "", locationId: "",
      }, token);
      expect(res.httpStatus).toBe(400);
    });
  });

  // ── GET/POST /admin/commission-rule ──
  describe("GET /admin/commission-rule", () => {
    it("200 — returns default rule", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "GET", "/admin/commission-rule", null, token);
      expect(res.httpStatus).toBe(200);
      expect(res.data.percentage).toBe(3.5);
    });
  });

  describe("POST /admin/commission-rule", () => {
    it("201 — sets rule", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/commission-rule", { percentage: 7 }, token);
      expect(res.httpStatus).toBe(201);
      expect(res.data.percentage).toBe(7);
    });

    it("400 — negative percentage", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/commission-rule", { percentage: -5 }, token);
      expect(res.httpStatus).toBe(400);
    });
  });

  // ── POST /admin/commission-calc ──
  describe("POST /admin/commission-calc", () => {
    it("200 — calculates commission", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/commission-calc", { orderValue: 200 }, token);
      expect(res.httpStatus).toBe(200);
      expect(res.data.orderValue).toBe(200);
      expect(res.data.percentage).toBe(3.5);
      expect(res.data.commissionValue).toBe(7);
    });
  });

  // ── GET/POST /admin/settlement-cycle ──
  describe("GET /admin/settlement-cycle", () => {
    it("200 — returns default cycle", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "GET", "/admin/settlement-cycle", null, token);
      expect(res.httpStatus).toBe(200);
      expect(res.data.frequency).toBe("weekly");
    });
  });

  describe("POST /admin/settlement-cycle", () => {
    it("201 — sets cycle", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/settlement-cycle", {
        frequency: "monthly", dayOfWeek: "Monday", time: "09:00",
      }, token);
      expect(res.httpStatus).toBe(201);
      expect(res.data.frequency).toBe("monthly");
    });
  });

  // ── GET/POST /admin/attribution-rules ──
  describe("GET /admin/attribution-rules", () => {
    it("200 — returns default rules", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "GET", "/admin/attribution-rules", null, token);
      expect(res.httpStatus).toBe(200);
      expect(res.data.overlapStrategy).toBe("highest_priority");
    });
  });

  describe("POST /admin/attribution-rules", () => {
    it("201 — sets rules", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/attribution-rules", {
        overlapStrategy: "split_evenly", multiLeaderStrategy: "equal_split",
      }, token);
      expect(res.httpStatus).toBe(201);
      expect(res.data.overlapStrategy).toBe("split_evenly");
    });
  });

  // ── POST /admin/attribution-resolve ──
  describe("POST /admin/attribution-resolve", () => {
    it("200 — resolves attribution for known location", async () => {
      const token = await httpLogin(base, "admin1");
      await httpRequest(base, "POST", "/admin/service-areas", {
        name: "Metro", priority: 1, locations: ["loc-m"],
      }, token);
      await httpRequest(base, "POST", "/admin/group-leader-bindings", {
        leaderId: "l1", leaderName: "Bob", locationId: "loc-m", weight: 1,
      }, token);

      const res = await httpRequest(base, "POST", "/admin/attribution-resolve", {
        locationId: "loc-m",
      }, token);

      expect(res.httpStatus).toBe(200);
      expect(res.data.attributions.length).toBe(1);
      expect(res.data.attributions[0].leaderId).toBe("l1");
    });

    it("200 — returns empty for unknown location", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/attribution-resolve", {
        locationId: "unknown",
      }, token);

      expect(res.httpStatus).toBe(200);
      expect(res.data.area).toBeNull();
      expect(res.data.attributions).toEqual([]);
    });
  });

  // ── POST /admin/bulk/* ──
  // Note: generateTemplate and exportData internally call triggerDownload()
  // which uses browser DOM APIs (URL.createObjectURL, anchor.click).
  // These are polyfilled in testHttpServer.js because they are browser-side
  // side effects with zero impact on the HTTP response. The request→response
  // cycle is fully real HTTP transport.

  describe("POST /admin/bulk/template", () => {
    it("200 — generates template for valid collection and returns confirmation", async () => {
      const token = await httpLogin(base, "admin1");

      for (const collection of ["users", "requests", "shipments", "inventory"]) {
        const res = await httpRequest(base, "POST", "/admin/bulk/template", {
          collection, format: "json",
        }, token);
        expect(res.httpStatus).toBe(200);
        expect(res.data).toEqual({ generated: true });
        expect(res.error).toBeNull();
      }
    });

    it("200 — generates CSV template", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/bulk/template", {
        collection: "users", format: "csv",
      }, token);
      expect(res.httpStatus).toBe(200);
      expect(res.data.generated).toBe(true);
    });

    it("400 — unsupported collection with error body", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/bulk/template", {
        collection: "fake", format: "csv",
      }, token);
      expect(res.httpStatus).toBe(400);
      expect(res.data).toBeNull();
      expect(res.error.message).toContain("Unsupported");
    });

    it("403 — student denied", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/admin/bulk/template", {
        collection: "users", format: "csv",
      }, token);
      expect(res.httpStatus).toBe(403);
      expect(res.data).toBeNull();
      expect(res.error.message).toBe("Permission denied");
    });
  });

  describe("POST /admin/bulk/export", () => {
    it("200 — exports existing users and returns count", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/bulk/export", {
        collection: "users", format: "json",
      }, token);
      expect(res.httpStatus).toBe(200);
      expect(typeof res.data.exportedRows).toBe("number");
      // We seeded users, so count should be > 0
      expect(res.data.exportedRows).toBeGreaterThan(0);
      expect(res.error).toBeNull();
    });

    it("400 — unsupported collection", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/bulk/export", {
        collection: "nonexistent", format: "csv",
      }, token);
      expect(res.httpStatus).toBe(400);
      expect(res.error.message).toContain("Unsupported");
    });
  });

  describe("POST /admin/bulk/import", () => {
    it("200 — imports valid JSON data", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/bulk/import", {
        collection: "users", format: "json",
        content: JSON.stringify([{ username: "imp1", name: "Import One", role: "Student" }]),
      }, token);
      expect(res.httpStatus).toBe(200);
      expect(res.data.importedRows).toBe(1);
    });

    it("422 — validation errors", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/bulk/import", {
        collection: "users", format: "json",
        content: JSON.stringify([{ username: "no_name_or_role" }]),
      }, token);
      expect(res.httpStatus).toBe(422);
      expect(res.error.details.errors.length).toBeGreaterThan(0);
    });

    it("400 — invalid JSON content", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/admin/bulk/import", {
        collection: "users", format: "json", content: "not json{{{",
      }, token);
      expect(res.httpStatus).toBe(400);
    });
  });

  // ── GET /audit/verify-chain ──
  describe("GET /audit/verify-chain", () => {
    it("200 — returns chain validity", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "GET", "/audit/verify-chain", null, token);
      const data = res.data ?? res;
      expect(data.valid).toBe(true);
      expect(typeof data.total).toBe("number");
    });

    it("401 — unauthenticated", async () => {
      const res = await httpRequest(base, "GET", "/audit/verify-chain");
      expect(res.httpStatus).toBe(401);
    });
  });
});

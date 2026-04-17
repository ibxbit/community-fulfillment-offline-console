import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLES } from "../src/auth/roles";
import {
  createApiTestContext,
  clearAll,
  seedAllUsers,
  loginAs,
} from "./apiTestHelpers";

// URL.createObjectURL is not available in jsdom; stub it for bulk operations
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = vi.fn();
}

describe("Admin route coverage", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createApiTestContext());
    await clearAll(services);
    await seedAllUsers(services);
  });

  // ── GET /admin/service-areas ──

  describe("GET /admin/service-areas", () => {
    it("returns empty list initially", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("GET /admin/service-areas", {
        auth: { token },
      });

      expect(result.status).toBe(200);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(0);
    });

    it("returns areas after creation", async () => {
      const token = await loginAs(services, "admin1");
      await services.router.call("POST /admin/service-areas", {
        auth: { token },
        name: "North Region",
        priority: 10,
        locations: ["loc-1", "loc-2"],
      });

      const result = await services.router.call("GET /admin/service-areas", {
        auth: { token },
      });

      expect(result.status).toBe(200);
      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toBe("North Region");
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call("GET /admin/service-areas", {});
      expect(result.status).toBe(401);
    });

    it("rejects unauthorized role (student has no service_areas:read)", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("GET /admin/service-areas", {
        auth: { token },
      });
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });

    it("allows operations role (has service_areas:read)", async () => {
      const token = await loginAs(services, "ops1");
      const result = await services.router.call("GET /admin/service-areas", {
        auth: { token },
      });
      expect(result.status).toBe(200);
    });
  });

  // ── POST /admin/service-areas ──

  describe("POST /admin/service-areas", () => {
    it("creates a new service area", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /admin/service-areas", {
        auth: { token },
        name: "South Region",
        priority: 50,
        locations: ["loc-3"],
      });

      expect(result.status).toBe(201);
      expect(result.data.name).toBe("South Region");
      expect(result.data.priority).toBe(50);
      expect(result.data.locations).toEqual(["loc-3"]);
    });

    it("rejects empty name", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /admin/service-areas", {
        auth: { token },
        name: "",
        locations: ["loc-1"],
      });

      expect(result.status).toBe(400);
      expect(result.error.message).toContain("name");
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "ops1");
      const result = await services.router.call("POST /admin/service-areas", {
        auth: { token },
        name: "Denied Area",
        locations: [],
      });
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── GET /admin/group-leader-bindings ──

  describe("GET /admin/group-leader-bindings", () => {
    it("returns empty list initially", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call(
        "GET /admin/group-leader-bindings",
        { auth: { token } },
      );

      expect(result.status).toBe(200);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call(
        "GET /admin/group-leader-bindings",
        {},
      );
      expect(result.status).toBe(401);
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call(
        "GET /admin/group-leader-bindings",
        { auth: { token } },
      );
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── POST /admin/group-leader-bindings ──

  describe("POST /admin/group-leader-bindings", () => {
    it("binds a group leader to a location", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call(
        "POST /admin/group-leader-bindings",
        {
          auth: { token },
          leaderId: "leader-1",
          leaderName: "Alice",
          locationId: "loc-1",
          weight: 2,
        },
      );

      expect(result.status).toBe(201);
      expect(result.data.leaderId).toBe("leader-1");
      expect(result.data.leaderName).toBe("Alice");
      expect(result.data.locationId).toBe("loc-1");
      expect(result.data.weight).toBe(2);
    });

    it("updates existing binding for same leader+location", async () => {
      const token = await loginAs(services, "admin1");

      await services.router.call("POST /admin/group-leader-bindings", {
        auth: { token },
        leaderId: "leader-1",
        leaderName: "Alice",
        locationId: "loc-1",
        weight: 1,
      });

      const updated = await services.router.call(
        "POST /admin/group-leader-bindings",
        {
          auth: { token },
          leaderId: "leader-1",
          leaderName: "Alice Updated",
          locationId: "loc-1",
          weight: 5,
        },
      );

      expect(updated.status).toBe(200);
      expect(updated.data.weight).toBe(5);
    });

    it("rejects missing required fields", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call(
        "POST /admin/group-leader-bindings",
        {
          auth: { token },
          leaderId: "",
          leaderName: "",
          locationId: "",
        },
      );

      expect(result.status).toBe(400);
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "finance1");
      const result = await services.router.call(
        "POST /admin/group-leader-bindings",
        {
          auth: { token },
          leaderId: "x",
          leaderName: "Y",
          locationId: "z",
        },
      );
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── GET /admin/commission-rule ──

  describe("GET /admin/commission-rule", () => {
    it("returns default commission rule", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("GET /admin/commission-rule", {
        auth: { token },
      });

      expect(result.status).toBe(200);
      expect(result.data.percentage).toBe(3.5);
      expect(result.data.rounding).toBe("nearest_cent");
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call(
        "GET /admin/commission-rule",
        {},
      );
      expect(result.status).toBe(401);
    });

    it("rejects unauthorized role (student lacks commissions:read)", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("GET /admin/commission-rule", {
        auth: { token },
      });
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });

    it("allows finance role (has commissions:read)", async () => {
      const token = await loginAs(services, "finance1");
      const result = await services.router.call("GET /admin/commission-rule", {
        auth: { token },
      });
      expect(result.status).toBe(200);
    });
  });

  // ── POST /admin/commission-rule ──

  describe("POST /admin/commission-rule", () => {
    it("sets a new commission rule", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /admin/commission-rule", {
        auth: { token },
        percentage: 5.25,
      });

      expect(result.status).toBe(201);
      expect(result.data.percentage).toBe(5.25);
    });

    it("persists and is returned by GET", async () => {
      const token = await loginAs(services, "admin1");
      await services.router.call("POST /admin/commission-rule", {
        auth: { token },
        percentage: 7,
      });

      const get = await services.router.call("GET /admin/commission-rule", {
        auth: { token },
      });
      expect(get.data.percentage).toBe(7);
    });

    it("rejects invalid percentage", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /admin/commission-rule", {
        auth: { token },
        percentage: -5,
      });
      expect(result.status).toBe(400);
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("POST /admin/commission-rule", {
        auth: { token },
        percentage: 5,
      });
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── POST /admin/commission-calc ──

  describe("POST /admin/commission-calc", () => {
    it("calculates commission on an order value", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /admin/commission-calc", {
        auth: { token },
        orderValue: 100,
      });

      expect(result.status).toBe(200);
      expect(result.data.orderValue).toBe(100);
      expect(result.data.percentage).toBe(3.5);
      expect(result.data.commissionValue).toBe(3.5);
    });

    it("uses custom commission rule after setting", async () => {
      const token = await loginAs(services, "admin1");
      await services.router.call("POST /admin/commission-rule", {
        auth: { token },
        percentage: 10,
      });

      const result = await services.router.call("POST /admin/commission-calc", {
        auth: { token },
        orderValue: 200,
      });

      expect(result.data.percentage).toBe(10);
      expect(result.data.commissionValue).toBe(20);
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call("POST /admin/commission-calc", {
        orderValue: 100,
      });
      expect(result.status).toBe(401);
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("POST /admin/commission-calc", {
        auth: { token },
        orderValue: 100,
      });
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── GET /admin/settlement-cycle ──

  describe("GET /admin/settlement-cycle", () => {
    it("returns default settlement cycle", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("GET /admin/settlement-cycle", {
        auth: { token },
      });

      expect(result.status).toBe(200);
      expect(result.data.frequency).toBe("weekly");
      expect(result.data.dayOfWeek).toBe("Friday");
      expect(result.data.time).toBe("18:00");
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call(
        "GET /admin/settlement-cycle",
        {},
      );
      expect(result.status).toBe(401);
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("GET /admin/settlement-cycle", {
        auth: { token },
      });
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── POST /admin/settlement-cycle ──

  describe("POST /admin/settlement-cycle", () => {
    it("sets a new settlement cycle", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call(
        "POST /admin/settlement-cycle",
        {
          auth: { token },
          frequency: "monthly",
          dayOfWeek: "Monday",
          time: "09:00",
        },
      );

      expect(result.status).toBe(201);
      expect(result.data.frequency).toBe("monthly");
      expect(result.data.dayOfWeek).toBe("Monday");
    });

    it("persists and is returned by GET", async () => {
      const token = await loginAs(services, "admin1");
      await services.router.call("POST /admin/settlement-cycle", {
        auth: { token },
        frequency: "daily",
        dayOfWeek: "Wednesday",
        time: "12:00",
      });

      const get = await services.router.call("GET /admin/settlement-cycle", {
        auth: { token },
      });
      expect(get.data.frequency).toBe("daily");
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call(
        "POST /admin/settlement-cycle",
        {
          auth: { token },
          frequency: "weekly",
        },
      );
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── GET /admin/attribution-rules ──

  describe("GET /admin/attribution-rules", () => {
    it("returns default attribution rules", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call(
        "GET /admin/attribution-rules",
        { auth: { token } },
      );

      expect(result.status).toBe(200);
      expect(result.data.overlapStrategy).toBe("highest_priority");
      expect(result.data.multiLeaderStrategy).toBe("weighted_split");
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call(
        "GET /admin/attribution-rules",
        {},
      );
      expect(result.status).toBe(401);
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call(
        "GET /admin/attribution-rules",
        { auth: { token } },
      );
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── POST /admin/attribution-rules ──

  describe("POST /admin/attribution-rules", () => {
    it("sets new attribution rules", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call(
        "POST /admin/attribution-rules",
        {
          auth: { token },
          overlapStrategy: "split_evenly",
          multiLeaderStrategy: "equal_split",
        },
      );

      expect(result.status).toBe(201);
      expect(result.data.overlapStrategy).toBe("split_evenly");
      expect(result.data.multiLeaderStrategy).toBe("equal_split");
    });

    it("persists and is returned by GET", async () => {
      const token = await loginAs(services, "admin1");
      await services.router.call("POST /admin/attribution-rules", {
        auth: { token },
        overlapStrategy: "first_match",
        multiLeaderStrategy: "single_primary",
      });

      const get = await services.router.call("GET /admin/attribution-rules", {
        auth: { token },
      });
      expect(get.data.overlapStrategy).toBe("first_match");
      expect(get.data.multiLeaderStrategy).toBe("single_primary");
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "finance1");
      const result = await services.router.call(
        "POST /admin/attribution-rules",
        {
          auth: { token },
          overlapStrategy: "split_evenly",
        },
      );
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── POST /admin/attribution-resolve ──

  describe("POST /admin/attribution-resolve", () => {
    it("resolves attribution for a location with area and leaders", async () => {
      const token = await loginAs(services, "admin1");

      await services.router.call("POST /admin/service-areas", {
        auth: { token },
        name: "Metro Area",
        priority: 1,
        locations: ["loc-metro"],
      });

      await services.router.call("POST /admin/group-leader-bindings", {
        auth: { token },
        leaderId: "leader-x",
        leaderName: "Xavier",
        locationId: "loc-metro",
        weight: 3,
      });

      const result = await services.router.call(
        "POST /admin/attribution-resolve",
        {
          auth: { token },
          locationId: "loc-metro",
        },
      );

      expect(result.status).toBe(200);
      expect(result.data.area).toBeTruthy();
      expect(result.data.attributions.length).toBe(1);
      expect(result.data.attributions[0].leaderId).toBe("leader-x");
      expect(result.data.attributions[0].ratio).toBe(1);
    });

    it("returns empty attributions for unknown location", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call(
        "POST /admin/attribution-resolve",
        {
          auth: { token },
          locationId: "unknown-loc",
        },
      );

      expect(result.status).toBe(200);
      expect(result.data.area).toBeNull();
      expect(result.data.attributions).toEqual([]);
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call(
        "POST /admin/attribution-resolve",
        { locationId: "loc" },
      );
      expect(result.status).toBe(401);
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call(
        "POST /admin/attribution-resolve",
        {
          auth: { token },
          locationId: "loc",
        },
      );
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── POST /admin/bulk/template ──

  describe("POST /admin/bulk/template", () => {
    it("generates a template for supported collection", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /admin/bulk/template", {
        auth: { token },
        collection: "users",
        format: "json",
      });

      expect(result.status).toBe(200);
      expect(result.data.generated).toBe(true);
    });

    it("rejects unsupported collection", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /admin/bulk/template", {
        auth: { token },
        collection: "nonexistent",
        format: "csv",
      });

      expect(result.status).toBe(400);
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("POST /admin/bulk/template", {
        auth: { token },
        collection: "users",
        format: "csv",
      });
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── POST /admin/bulk/export ──

  describe("POST /admin/bulk/export", () => {
    it("exports data for a valid collection", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /admin/bulk/export", {
        auth: { token },
        collection: "users",
        format: "json",
      });

      expect(result.status).toBe(200);
      expect(result.data.exportedRows).toBeGreaterThanOrEqual(0);
    });

    it("rejects unsupported collection", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /admin/bulk/export", {
        auth: { token },
        collection: "nonexistent",
        format: "csv",
      });

      expect(result.status).toBe(400);
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("POST /admin/bulk/export", {
        auth: { token },
        collection: "users",
        format: "csv",
      });
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── POST /admin/bulk/import ──

  describe("POST /admin/bulk/import", () => {
    it("imports valid JSON rows", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /admin/bulk/import", {
        auth: { token },
        collection: "users",
        format: "json",
        content: JSON.stringify([
          { username: "import1", name: "Import One", role: "Student" },
          { username: "import2", name: "Import Two", role: "Teacher" },
        ]),
      });

      expect(result.status).toBe(200);
      expect(result.data.importedRows).toBe(2);
    });

    it("imports valid CSV rows", async () => {
      const token = await loginAs(services, "admin1");
      const csv = "username,name,role\nimport3,Import Three,Student";
      const result = await services.router.call("POST /admin/bulk/import", {
        auth: { token },
        collection: "users",
        format: "csv",
        content: csv,
      });

      expect(result.status).toBe(200);
      expect(result.data.importedRows).toBe(1);
    });

    it("rejects rows with missing required fields", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /admin/bulk/import", {
        auth: { token },
        collection: "users",
        format: "json",
        content: JSON.stringify([{ username: "no_name_or_role" }]),
      });

      expect(result.status).toBe(422);
      expect(result.error.details.errors.length).toBeGreaterThan(0);
    });

    it("rejects invalid JSON content", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /admin/bulk/import", {
        auth: { token },
        collection: "users",
        format: "json",
        content: "not valid json {{{",
      });

      expect(result.status).toBe(400);
    });

    it("rejects unsupported collection", async () => {
      const token = await loginAs(services, "admin1");
      const result = await services.router.call("POST /admin/bulk/import", {
        auth: { token },
        collection: "nonexistent",
        format: "json",
        content: "[]",
      });

      expect(result.status).toBe(400);
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("POST /admin/bulk/import", {
        auth: { token },
        collection: "users",
        format: "json",
        content: "[]",
      });
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });
});

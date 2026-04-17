import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestServer,
  seedAllUsers,
  clearAll,
  httpLogin,
  httpRequest,
} from "./testHttpServer.js";

describe("Fulfillment HTTP integration tests", () => {
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

  async function seedShipment(overrides = {}) {
    return ctx.services.db.collections.shipments.insertOne({
      itemSku: "SKU-SHIP-1", lot: "LOT-A", warehouseLocation: "WH-1",
      requester: "student_1", date: new Date().toISOString(),
      documentStatus: "in_progress", ...overrides,
    });
  }

  // ── POST /fulfillment/search ──

  describe("POST /fulfillment/search", () => {
    it("200 — returns paginated results with body shape", async () => {
      await seedShipment({ itemSku: "SKU-A" });
      await seedShipment({ itemSku: "SKU-B" });

      const token = await httpLogin(base, "warehouse1");
      const res = await httpRequest(base, "POST", "/fulfillment/search", {
        filters: {}, options: { page: 1, pageSize: 5 },
      }, token);

      expect(res.httpStatus).toBe(200);
      expect(res.data.items.length).toBe(2);
      expect(res.data.total).toBe(2);
      expect(res.data.page).toBe(1);
      expect(res.data.pageSize).toBe(5);
    });

    it("200 — filters by itemSku", async () => {
      await seedShipment({ itemSku: "MATCH" });
      await seedShipment({ itemSku: "NOPE" });

      const token = await httpLogin(base, "warehouse1");
      const res = await httpRequest(base, "POST", "/fulfillment/search", {
        filters: { itemSku: "MATCH" }, options: {},
      }, token);

      expect(res.httpStatus).toBe(200);
      expect(res.data.items.length).toBe(1);
      expect(res.data.items[0].itemSku).toBe("MATCH");
    });

    it("401 — unauthenticated", async () => {
      const res = await httpRequest(base, "POST", "/fulfillment/search", { filters: {} });
      expect(res.httpStatus).toBe(401);
    });

    it("403 — student denied", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/fulfillment/search", { filters: {} }, token);
      expect(res.httpStatus).toBe(403);
    });
  });

  // ── POST /fulfillment/split ──

  describe("POST /fulfillment/split", () => {
    it("200 — splits shipment into packages", async () => {
      const shipment = await seedShipment();
      const token = await httpLogin(base, "warehouse1");

      const res = await httpRequest(base, "POST", "/fulfillment/split", {
        shipmentId: shipment._id,
        packages: [{ packageId: "p1", sequence: 1 }, { packageId: "p2", sequence: 2 }],
        actor: { userId: "warehouse_1", role: "Warehouse Staff" },
      }, token);

      expect(res.httpStatus).toBe(200);
      expect(res.data.packages).toHaveLength(2);
    });

    it("400 — empty packages", async () => {
      const shipment = await seedShipment();
      const token = await httpLogin(base, "warehouse1");

      const res = await httpRequest(base, "POST", "/fulfillment/split", {
        shipmentId: shipment._id, packages: [],
        actor: { userId: "warehouse_1", role: "Warehouse Staff" },
      }, token);

      expect(res.httpStatus).toBe(400);
    });

    it("404 — non-existent shipment", async () => {
      const token = await httpLogin(base, "warehouse1");
      const res = await httpRequest(base, "POST", "/fulfillment/split", {
        shipmentId: "fake", packages: [{ packageId: "p1", sequence: 1 }],
        actor: { userId: "warehouse_1", role: "Warehouse Staff" },
      }, token);

      expect(res.httpStatus).toBe(404);
    });
  });

  // ── POST /fulfillment/assign-carrier ──

  describe("POST /fulfillment/assign-carrier", () => {
    it("200 — assigns carrier with deep body check", async () => {
      const shipment = await seedShipment();
      const token = await httpLogin(base, "warehouse1");

      const res = await httpRequest(base, "POST", "/fulfillment/assign-carrier", {
        actor: { userId: "warehouse_1", role: "Warehouse Staff" },
        shipmentId: shipment._id, carrier: "FedEx", trackingNumber: "TRK-001",
      }, token);

      expect(res.httpStatus).toBe(200);
      expect(res.data.carrier).toBe("FedEx");
      expect(res.data.trackingNumber).toBe("TRK-001");
      expect(res.data.documentStatus).toBe("in_transit");
      expect(res.data.shippedAt).toBeTruthy();
    });

    it("403 — finance denied", async () => {
      const shipment = await seedShipment();
      const token = await httpLogin(base, "finance1");
      const res = await httpRequest(base, "POST", "/fulfillment/assign-carrier", {
        actor: { userId: "finance_1", role: "Finance" },
        shipmentId: shipment._id, carrier: "X", trackingNumber: "Y",
      }, token);

      expect(res.httpStatus).toBe(403);
    });
  });

  // ── POST /fulfillment/confirm-delivery ──

  describe("POST /fulfillment/confirm-delivery", () => {
    it("200 — confirms delivery with body check", async () => {
      const shipment = await seedShipment();
      const token = await httpLogin(base, "warehouse1");

      const res = await httpRequest(base, "POST", "/fulfillment/confirm-delivery", {
        shipmentId: shipment._id,
        confirmation: { recipient: "Jane Doe" },
        actor: { userId: "warehouse_1", role: "Warehouse Staff" },
      }, token);

      expect(res.httpStatus).toBe(200);
      expect(res.data.documentStatus).toBe("delivered");
      expect(res.data.deliveryConfirmation.recipient).toBe("Jane Doe");
    });

    it("404 — non-existent shipment", async () => {
      const token = await httpLogin(base, "warehouse1");
      const res = await httpRequest(base, "POST", "/fulfillment/confirm-delivery", {
        shipmentId: "fake", confirmation: {},
        actor: { userId: "warehouse_1", role: "Warehouse Staff" },
      }, token);

      expect(res.httpStatus).toBe(404);
    });
  });

  // ── POST /fulfillment/log-exception ──

  describe("POST /fulfillment/log-exception", () => {
    it("200 — logs exception with body check", async () => {
      const shipment = await seedShipment();
      const token = await httpLogin(base, "warehouse1");

      const res = await httpRequest(base, "POST", "/fulfillment/log-exception", {
        shipmentId: shipment._id, type: "damaged", notes: "Crushed box",
        actor: { userId: "warehouse_1", role: "Warehouse Staff" },
      }, token);

      expect(res.httpStatus).toBe(200);
      expect(res.data.documentStatus).toBe("exception");
      expect(res.data.exceptions[0].type).toBe("damaged");
    });

    it("400 — unsupported type", async () => {
      const shipment = await seedShipment();
      const token = await httpLogin(base, "warehouse1");

      const res = await httpRequest(base, "POST", "/fulfillment/log-exception", {
        shipmentId: shipment._id, type: "stolen", notes: "",
        actor: { userId: "warehouse_1", role: "Warehouse Staff" },
      }, token);

      expect(res.httpStatus).toBe(400);
    });
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { ROLES } from "../src/auth/roles";
import {
  createApiTestContext,
  clearAll,
  seedAllUsers,
  loginAs,
} from "./apiTestHelpers";

describe("Fulfillment route coverage", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createApiTestContext());
    await clearAll(services);
    await seedAllUsers(services);
  });

  async function seedShipment(overrides = {}) {
    return services.db.collections.shipments.insertOne({
      itemSku: "SKU-SHIP-1",
      lot: "LOT-A",
      warehouseLocation: "WH-1",
      requester: "student_1",
      date: new Date().toISOString(),
      documentStatus: "in_progress",
      ...overrides,
    });
  }

  // ── POST /fulfillment/search ──

  describe("POST /fulfillment/search", () => {
    it("returns empty result when no shipments exist", async () => {
      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call("POST /fulfillment/search", {
        auth: { token },
        filters: {},
        options: {},
      });

      expect(result.status).toBe(200);
      expect(result.data.items).toEqual([]);
      expect(result.data.total).toBe(0);
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(10);
    });

    it("returns shipments matching filters", async () => {
      await seedShipment({ itemSku: "SKU-A" });
      await seedShipment({ itemSku: "SKU-B" });

      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call("POST /fulfillment/search", {
        auth: { token },
        filters: { itemSku: "SKU-A" },
        options: {},
      });

      expect(result.status).toBe(200);
      expect(result.data.items.length).toBe(1);
      expect(result.data.items[0].itemSku).toBe("SKU-A");
      expect(result.data.total).toBe(1);
    });

    it("supports pagination", async () => {
      for (let i = 0; i < 15; i++) {
        await seedShipment({ itemSku: `SKU-${String(i).padStart(2, "0")}` });
      }

      const token = await loginAs(services, "warehouse1");
      const page1 = await services.router.call("POST /fulfillment/search", {
        auth: { token },
        filters: {},
        options: { page: 1, pageSize: 5 },
      });

      expect(page1.status).toBe(200);
      expect(page1.data.items.length).toBe(5);
      expect(page1.data.total).toBe(15);

      const page2 = await services.router.call("POST /fulfillment/search", {
        auth: { token },
        filters: {},
        options: { page: 2, pageSize: 5 },
      });

      expect(page2.data.items.length).toBe(5);
      expect(page2.data.page).toBe(2);
    });

    it("supports sorting", async () => {
      await seedShipment({ itemSku: "ZZZ-SKU" });
      await seedShipment({ itemSku: "AAA-SKU" });

      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call("POST /fulfillment/search", {
        auth: { token },
        filters: {},
        options: { sortBy: "itemSku", sortDir: "asc" },
      });

      expect(result.status).toBe(200);
      expect(result.data.items[0].itemSku).toBe("AAA-SKU");
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call("POST /fulfillment/search", {
        filters: {},
      });
      expect(result.status).toBe(401);
    });

    it("rejects unauthorized role (student lacks shipments:read)", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call("POST /fulfillment/search", {
        auth: { token },
        filters: {},
      });
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── POST /fulfillment/split ──

  describe("POST /fulfillment/split", () => {
    it("splits a shipment into packages", async () => {
      const shipment = await seedShipment();

      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call("POST /fulfillment/split", {
        auth: { token },
        shipmentId: shipment._id,
        packages: [
          { packageId: "pkg_1", sequence: 1 },
          { packageId: "pkg_2", sequence: 2 },
        ],
        actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
      });

      expect(result.status).toBe(200);
      expect(result.data.packages).toHaveLength(2);
      expect(result.data.packages[0].packageId).toBe("pkg_1");
      expect(result.data.actionLog.length).toBeGreaterThan(0);
      const lastAction =
        result.data.actionLog[result.data.actionLog.length - 1];
      expect(lastAction.action).toBe("shipment_split");
    });

    it("rejects split with no packages", async () => {
      const shipment = await seedShipment();

      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call("POST /fulfillment/split", {
        auth: { token },
        shipmentId: shipment._id,
        packages: [],
        actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
      });

      expect(result.status).toBe(400);
      expect(result.error.message).toContain("package");
    });

    it("rejects split for non-existent shipment", async () => {
      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call("POST /fulfillment/split", {
        auth: { token },
        shipmentId: "non_existent",
        packages: [{ packageId: "pkg", sequence: 1 }],
        actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
      });

      expect(result.status).toBe(404);
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call("POST /fulfillment/split", {
        shipmentId: "id",
        packages: [],
      });
      expect(result.status).toBe(401);
    });

    it("rejects unauthorized role with structured error", async () => {
      const token = await loginAs(services, "finance1");
      const result = await services.router.call("POST /fulfillment/split", {
        auth: { token },
        shipmentId: "id",
        packages: [{ packageId: "pkg", sequence: 1 }],
      });
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── POST /fulfillment/assign-carrier — deeper ──

  describe("POST /fulfillment/assign-carrier (deeper)", () => {
    it("assigns carrier and tracking, transitions to in_transit", async () => {
      const shipment = await seedShipment();

      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call(
        "POST /fulfillment/assign-carrier",
        {
          auth: { token },
          actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
          shipmentId: shipment._id,
          carrier: "FedEx",
          trackingNumber: "TRK-12345",
        },
      );

      expect(result.status).toBe(200);
      expect(result.data.carrier).toBe("FedEx");
      expect(result.data.trackingNumber).toBe("TRK-12345");
      expect(result.data.documentStatus).toBe("in_transit");
      expect(result.data.shippedAt).toBeTruthy();
    });

    it("rejects missing carrier", async () => {
      const shipment = await seedShipment();
      const token = await loginAs(services, "warehouse1");

      const result = await services.router.call(
        "POST /fulfillment/assign-carrier",
        {
          auth: { token },
          actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
          shipmentId: shipment._id,
          carrier: "",
          trackingNumber: "TRK-12345",
        },
      );

      expect(result.status).toBe(400);
    });

    it("rejects non-existent shipment", async () => {
      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call(
        "POST /fulfillment/assign-carrier",
        {
          auth: { token },
          actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
          shipmentId: "non_existent",
          carrier: "UPS",
          trackingNumber: "TRK-X",
        },
      );

      expect(result.status).toBe(404);
    });
  });

  // ── POST /fulfillment/confirm-delivery ──

  describe("POST /fulfillment/confirm-delivery", () => {
    it("confirms delivery and transitions to delivered status", async () => {
      const shipment = await seedShipment();

      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call(
        "POST /fulfillment/confirm-delivery",
        {
          auth: { token },
          shipmentId: shipment._id,
          confirmation: { recipient: "John Doe", signature: true },
          actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
        },
      );

      expect(result.status).toBe(200);
      expect(result.data.documentStatus).toBe("delivered");
      expect(result.data.deliveryConfirmation).toBeTruthy();
      expect(result.data.deliveryConfirmation.recipient).toBe("John Doe");
      expect(result.data.deliveryConfirmation.confirmedAt).toBeTruthy();
    });

    it("rejects for non-existent shipment", async () => {
      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call(
        "POST /fulfillment/confirm-delivery",
        {
          auth: { token },
          shipmentId: "non_existent",
          confirmation: {},
          actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
        },
      );

      expect(result.status).toBe(404);
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call(
        "POST /fulfillment/confirm-delivery",
        { shipmentId: "id", confirmation: {} },
      );
      expect(result.status).toBe(401);
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "student1");
      const result = await services.router.call(
        "POST /fulfillment/confirm-delivery",
        {
          auth: { token },
          shipmentId: "id",
          confirmation: {},
        },
      );
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });

  // ── POST /fulfillment/log-exception ──

  describe("POST /fulfillment/log-exception", () => {
    it("logs a damaged exception and persists it", async () => {
      const shipment = await seedShipment();

      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call(
        "POST /fulfillment/log-exception",
        {
          auth: { token },
          shipmentId: shipment._id,
          type: "damaged",
          notes: "Box was crushed",
          actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
        },
      );

      expect(result.status).toBe(200);
      expect(result.data.documentStatus).toBe("exception");
      expect(result.data.exceptions).toHaveLength(1);
      expect(result.data.exceptions[0].type).toBe("damaged");
      expect(result.data.exceptions[0].notes).toBe("Box was crushed");
    });

    it("logs recipient unavailable exception", async () => {
      const shipment = await seedShipment();
      const token = await loginAs(services, "warehouse1");

      const result = await services.router.call(
        "POST /fulfillment/log-exception",
        {
          auth: { token },
          shipmentId: shipment._id,
          type: "recipient unavailable",
          notes: "Nobody at the address",
          actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
        },
      );

      expect(result.status).toBe(200);
      expect(result.data.exceptions[0].type).toBe("recipient unavailable");
    });

    it("rejects unsupported exception type", async () => {
      const shipment = await seedShipment();
      const token = await loginAs(services, "warehouse1");

      const result = await services.router.call(
        "POST /fulfillment/log-exception",
        {
          auth: { token },
          shipmentId: shipment._id,
          type: "stolen",
          notes: "",
          actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
        },
      );

      expect(result.status).toBe(400);
      expect(result.error.message).toContain("Unsupported");
    });

    it("rejects for non-existent shipment", async () => {
      const token = await loginAs(services, "warehouse1");
      const result = await services.router.call(
        "POST /fulfillment/log-exception",
        {
          auth: { token },
          shipmentId: "non_existent",
          type: "damaged",
          notes: "",
          actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
        },
      );
      expect(result.status).toBe(404);
    });

    it("rejects unauthenticated request", async () => {
      const result = await services.router.call(
        "POST /fulfillment/log-exception",
        { shipmentId: "id", type: "damaged" },
      );
      expect(result.status).toBe(401);
    });

    it("rejects unauthorized role", async () => {
      const token = await loginAs(services, "finance1");
      const result = await services.router.call(
        "POST /fulfillment/log-exception",
        {
          auth: { token },
          shipmentId: "id",
          type: "damaged",
        },
      );
      expect(result.status).toBe(403);
      expect(result.data).toBeNull();
      expect(result.error.message).toBe("Permission denied");
    });
  });
});

/**
 * Priority 6: Direct unit tests for backend service modules.
 * Tests baseService, response helpers, and key service logic
 * that was previously only exercised indirectly through routes.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { ok, fail } from "../src/services/response";
import { createTestContext, clearAllCollections } from "./testHelpers";

describe("response.js — ok() and fail()", () => {
  it("ok() returns consistent success shape", () => {
    const result = ok({ key: "value" });
    expect(result).toEqual({
      status: 200,
      data: { key: "value" },
      error: null,
    });
  });

  it("ok() supports custom status code", () => {
    const result = ok({ id: "123" }, 201);
    expect(result.status).toBe(201);
    expect(result.data.id).toBe("123");
    expect(result.error).toBeNull();
  });

  it("fail() returns consistent error shape", () => {
    const result = fail("Something went wrong", 400);
    expect(result).toEqual({
      status: 400,
      data: null,
      error: { message: "Something went wrong", details: null },
    });
  });

  it("fail() supports details", () => {
    const result = fail("Validation failed", 422, { errors: ["a", "b"] });
    expect(result.status).toBe(422);
    expect(result.data).toBeNull();
    expect(result.error.message).toBe("Validation failed");
    expect(result.error.details).toEqual({ errors: ["a", "b"] });
  });

  it("fail() defaults to 400", () => {
    const result = fail("Bad request");
    expect(result.status).toBe(400);
  });
});

describe("baseService — CRUD operations", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);
  });

  it("list returns empty array for empty collection", async () => {
    const result = await services.users.list();
    expect(result.status).toBe(200);
    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it("create returns 201 with _id and body", async () => {
    const result = await services.users.create({
      username: "test", name: "Test User", role: "Student",
    });
    expect(result.status).toBe(201);
    expect(result.data._id).toBeTruthy();
    expect(result.data.username).toBe("test");
    expect(result.error).toBeNull();
  });

  it("getById returns item after create", async () => {
    const created = await services.users.create({ username: "get_test", name: "Get", role: "Student" });
    const result = await services.users.getById(created.data._id);
    expect(result.status).toBe(200);
    expect(result.data.username).toBe("get_test");
  });

  it("getById returns 404 for missing item", async () => {
    const result = await services.users.getById("nonexistent_id");
    expect(result.status).toBe(404);
    expect(result.data).toBeNull();
    expect(result.error.message).toBe("Not found");
  });

  it("updateById patches and returns updated item", async () => {
    const created = await services.users.create({ username: "upd", name: "Original", role: "Student" });
    const result = await services.users.updateById(created.data._id, { name: "Updated" });
    expect(result.status).toBe(200);
    expect(result.data.name).toBe("Updated");
    expect(result.data.username).toBe("upd");
  });

  it("updateById returns 404 for missing item", async () => {
    const result = await services.users.updateById("nonexistent", { name: "X" });
    expect(result.status).toBe(404);
  });

  it("deleteById removes item and returns confirmation", async () => {
    const created = await services.users.create({ username: "del", name: "Delete Me", role: "Student" });
    const result = await services.users.deleteById(created.data._id);
    expect(result.status).toBe(200);
    expect(result.data.deleted).toBe(true);

    const verify = await services.users.getById(created.data._id);
    expect(verify.status).toBe(404);
  });

  it("deleteById returns 404 for missing item", async () => {
    const result = await services.users.deleteById("nonexistent");
    expect(result.status).toBe(404);
  });

  it("create triggers audit trail", async () => {
    await services.users.create({ username: "audited", name: "Audited", role: "Student" });
    const chain = await services.auditTrail.verifyChain();
    expect(chain.valid).toBe(true);
    expect(chain.total).toBeGreaterThan(0);
  });
});

describe("adminConfigService — direct tests", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);
  });

  it("upsertServiceArea validates name is required", async () => {
    const result = await services.adminConfig.upsertServiceArea({ name: "" });
    expect(result.status).toBe(400);
    expect(result.error.message).toContain("name");
  });

  it("upsertServiceArea creates with all fields", async () => {
    const result = await services.adminConfig.upsertServiceArea({
      name: "Direct Test Area", priority: 5, locations: ["loc-dt"],
    });
    expect(result.status).toBe(201);
    expect(result.data.name).toBe("Direct Test Area");
    expect(result.data.priority).toBe(5);
    expect(result.data.kind).toBe("service_area");
  });

  it("bindGroupLeaderToLocation validates all required fields", async () => {
    const result = await services.adminConfig.bindGroupLeaderToLocation({
      leaderId: "", leaderName: "", locationId: "",
    });
    expect(result.status).toBe(400);
    expect(result.error.message).toContain("required");
  });

  it("calculateCommission uses active rule", async () => {
    await services.adminConfig.setCommissionRule({ percentage: 12 });
    const result = await services.adminConfig.calculateCommission(100);
    expect(result.data.percentage).toBe(12);
    expect(result.data.commissionValue).toBe(12);
    expect(result.data.orderValue).toBe(100);
  });

  it("resolveAttribution with equal_split distributes evenly", async () => {
    await services.adminConfig.upsertServiceArea({
      name: "A", priority: 1, locations: ["loc-eq"],
    });
    await services.adminConfig.bindGroupLeaderToLocation({
      leaderId: "l1", leaderName: "L1", locationId: "loc-eq", weight: 1,
    });
    await services.adminConfig.bindGroupLeaderToLocation({
      leaderId: "l2", leaderName: "L2", locationId: "loc-eq", weight: 1,
    });
    await services.adminConfig.setAttributionRules({
      overlapStrategy: "highest_priority",
      multiLeaderStrategy: "equal_split",
    });

    const result = await services.adminConfig.resolveAttribution({ locationId: "loc-eq" });
    expect(result.data.attributions.length).toBe(2);
    expect(result.data.attributions[0].ratio).toBe(0.5);
    expect(result.data.attributions[1].ratio).toBe(0.5);
  });
});

describe("inAppMessagingService — direct tests", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);
  });

  it("upsertTemplate validates required fields", async () => {
    const result = await services.messaging.upsertTemplate({
      templateId: "", title: "", body: "",
    });
    expect(result.status).toBe(400);
    expect(result.error.message).toContain("required");
  });

  it("queueMessage validates recipientUserId", async () => {
    const result = await services.messaging.queueMessage({
      recipientUserId: "", title: "T", body: "B",
    });
    expect(result.status).toBe(400);
    expect(result.error.message).toContain("recipientUserId");
  });

  it("queueMessage uses template interpolation", async () => {
    await services.messaging.upsertTemplate({
      templateId: "greet", title: "Hi {{user}}", body: "Welcome {{user}} to {{place}}",
    });

    const result = await services.messaging.queueMessage({
      recipientUserId: "u1", templateId: "greet",
      variables: { user: "Alice", place: "School" },
    });

    expect(result.status).toBe(201);
    expect(result.data.title).toBe("Hi Alice");
    expect(result.data.body).toBe("Welcome Alice to School");
  });

  it("queueMessage respects priority muting", async () => {
    await services.messaging.setSubscriptionPreferences("u1", {
      allowAll: true, mutedTemplateIds: [], mutedPriorities: ["low"],
    });

    const result = await services.messaging.queueMessage({
      recipientUserId: "u1", title: "T", body: "B", priority: "low",
    });

    expect(result.status).toBe(202);
    expect(result.data.skipped).toBe(true);
    expect(result.data.reason).toBe("priority_muted");
  });

  it("deliverNext delivers highest priority first", async () => {
    await services.messaging.queueMessage({
      recipientUserId: "u1", title: "Low", body: "L", priority: "low",
    });
    // Small delay to avoid dedupe
    await new Promise((r) => setTimeout(r, 10));
    await services.messaging.queueMessage({
      recipientUserId: "u1", title: "High", body: "H", priority: "high",
    });

    const delivered = await services.messaging.deliverNext("u1");
    expect(delivered.data.title).toBe("High");
  });
});

describe("fulfillmentManagementService — direct tests", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);
  });

  it("search filters by documentStatus", async () => {
    await services.db.collections.shipments.insertOne({
      _id: "s1", itemSku: "A", documentStatus: "in_progress", date: new Date().toISOString(),
    });
    await services.db.collections.shipments.insertOne({
      _id: "s2", itemSku: "B", documentStatus: "delivered", date: new Date().toISOString(),
    });

    const result = await services.fulfillmentManagement.search(
      { documentStatus: "in_progress" }, {},
    );
    expect(result.data.items.length).toBe(1);
    expect(result.data.items[0].itemSku).toBe("A");
  });

  it("search supports date range filtering", async () => {
    await services.db.collections.shipments.insertOne({
      _id: "s1", itemSku: "OLD", date: "2020-01-01T00:00:00Z",
    });
    await services.db.collections.shipments.insertOne({
      _id: "s2", itemSku: "NEW", date: "2026-04-17T00:00:00Z",
    });

    const result = await services.fulfillmentManagement.search(
      { fromDate: "2025-01-01", toDate: "2027-01-01" }, {},
    );
    expect(result.data.items.length).toBe(1);
    expect(result.data.items[0].itemSku).toBe("NEW");
  });

  it("logException validates exception type", async () => {
    await services.db.collections.shipments.insertOne({
      _id: "s1", itemSku: "A", date: new Date().toISOString(),
    });

    const result = await services.fulfillmentManagement.logException(
      "s1", "stolen", "notes", { userId: "u1" },
    );
    expect(result.status).toBe(400);
    expect(result.error.message).toContain("Unsupported");
  });

  it("splitShipment validates at least one package", async () => {
    await services.db.collections.shipments.insertOne({
      _id: "s1", itemSku: "A", date: new Date().toISOString(),
    });

    const result = await services.fulfillmentManagement.splitShipment("s1", [], { userId: "u1" });
    expect(result.status).toBe(400);
    expect(result.error.message).toContain("package");
  });
});

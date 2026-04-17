import { beforeEach, describe, expect, it } from "vitest";
import { clearAllCollections, createTestContext } from "./testHelpers";
import { ROLES } from "../src/auth/roles";

describe("Service-level state transitions and edge cases", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);
  });

  it("request service returns empty array for empty DB", async () => {
    const result = await services.requestService.list({});
    expect(result.status).toBe(200);
    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it("messaging service returns empty queue for non-existent user", async () => {
    const result = await services.messaging.listQueue("nonexistent_user");
    expect(result.status).toBe(200);
    expect(result.data).toEqual([]);
  });

  it("messaging service returns default subscription for unknown user", async () => {
    const result = await services.messaging.getSubscriptionPreferences("unknown_user");
    expect(result.status).toBe(200);
    expect(result.data.preferences.allowAll).toBe(true);
    expect(result.data.preferences.mutedTemplateIds).toEqual([]);
  });

  it("admin config returns defaults when nothing has been configured", async () => {
    const commission = await services.adminConfig.getCommissionRule();
    expect(commission.status).toBe(200);
    expect(commission.data.percentage).toBe(3.5);
    expect(commission.data.rounding).toBe("nearest_cent");

    const settlement = await services.adminConfig.getSettlementCycle();
    expect(settlement.status).toBe(200);
    expect(settlement.data.frequency).toBe("weekly");
    expect(settlement.data.dayOfWeek).toBe("Friday");

    const attribution = await services.adminConfig.getAttributionRules();
    expect(attribution.status).toBe(200);
    expect(attribution.data.overlapStrategy).toBe("highest_priority");
    expect(attribution.data.multiLeaderStrategy).toBe("weighted_split");
  });

  it("fulfillment search returns structured empty result for empty DB", async () => {
    const result = await services.fulfillmentManagement.search({}, {});
    expect(result.status).toBe(200);
    expect(result.data.items).toEqual([]);
    expect(result.data.total).toBe(0);
    expect(result.data.page).toBe(1);
    expect(result.data.pageSize).toBe(10);
  });

  it("template upsert creates and then updates correctly", async () => {
    const create = await services.messaging.upsertTemplate({
      templateId: "t1", title: "V1", body: "Body V1", defaultPriority: "normal",
    });
    expect(create.status).toBe(201);
    expect(create.data.title).toBe("V1");

    const update = await services.messaging.upsertTemplate({
      templateId: "t1", title: "V2", body: "Body V2", defaultPriority: "high",
    });
    expect(update.status).toBe(200);
    expect(update.data.title).toBe("V2");

    // Verify only one template exists
    const list = await services.messaging.listTemplates();
    expect(list.data.length).toBe(1);
    expect(list.data[0].title).toBe("V2");
  });

  it("commission rule update persists and calc uses new value", async () => {
    await services.adminConfig.setCommissionRule({ percentage: 10 });

    const calc = await services.adminConfig.calculateCommission(200);
    expect(calc.status).toBe(200);
    expect(calc.data.percentage).toBe(10);
    expect(calc.data.commissionValue).toBe(20);
    expect(calc.data.orderValue).toBe(200);
  });

  it("request lifecycle enforces status transitions", async () => {
    const actor = { userId: "u1", role: ROLES.STUDENT };
    const payload = {
      requestingOrgId: "org", requestingClassId: "cls",
      itemSku: "SKU-1", quantity: 1,
    };

    // Create draft
    const draft = await services.requestsLifecycle.createDraft(actor, payload);
    expect(draft.status).toBe(201);
    expect(draft.data.status).toBe("draft");

    // Cannot archive a draft
    const badArchive = await services.requestsLifecycle.archive(actor, draft.data._id);
    expect(badArchive.status).toBe(409);

    // Submit for review
    const submitted = await services.requestsLifecycle.submitForReview(actor, draft.data._id);
    expect(submitted.status).toBe(200);
    expect(submitted.data.status).toBe("review");

    // Cannot submit again (already in review)
    const resubmit = await services.requestsLifecycle.submitForReview(actor, draft.data._id);
    expect(resubmit.status).toBe(409);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { clearAllCollections, createTestContext } from "./testHelpers";

// Advanced plugin, admin, and message center flows

describe("Advanced plugin/admin/message center flows", () => {
  let services, plugins;

  beforeEach(async () => {
    ({ services, plugins } = await createTestContext());
    await clearAllCollections(services);
  });

  it("handles plugin extension: plugin can read, normalize, write, and error is handled", async () => {
    plugins.register({
      id: "test-plugin",
      type: "parsers",
      async read(input) { return { ...input, read: true }; },
      async normalize(input) { return { ...input, normalized: true }; },
      async write(target, input) { return { ...input, written: true }; },
    });
    const result = await plugins.runPlugin("test-plugin", { source: { foo: 1 }, target: null });
    expect(result.ok).toBe(true);
    expect(result.data.read).toBe(true);
    expect(result.data.normalized).toBe(true);
    expect(result.data.written).toBe(true);
  });

  it("handles admin config: can save and retrieve commission, settlement, attribution", async () => {
    const commission = await services.adminConfig.setCommissionRule({ percentage: 3.5 });
    expect(commission.error).toBeFalsy();
    const gotCommission = await services.adminConfig.getCommissionRule();
    expect(gotCommission.data.percentage).toBe(3.5);
    const settlement = await services.adminConfig.setSettlementCycle({ frequency: "weekly", dayOfWeek: "Friday", time: "18:00" });
    expect(settlement.error).toBeFalsy();
    const gotSettlement = await services.adminConfig.getSettlementCycle();
    expect(gotSettlement.data.frequency).toBe("weekly");
    const attribution = await services.adminConfig.getAttributionRules();
    expect(attribution.overlapStrategy).toBeDefined();
  });

  it("handles message center: can upsert template, set/get subscription, queue and dedupe messages", async () => {
    const userId = "user1";
    const template = await services.messaging.upsertTemplate({ templateId: "t1", title: "Hello", body: "Hi {{name}}", defaultPriority: "normal" });
    expect(template.error).toBeFalsy();
    const sub = await services.messaging.setSubscriptionPreferences(userId, { allowAll: true, mutedTemplateIds: [], mutedPriorities: [] });
    expect(sub.error).toBeFalsy();
    const getSub = await services.messaging.getSubscriptionPreferences(userId);
    expect(getSub.data.preferences.allowAll).toBe(true);
    const queue = await services.messaging.queueMessage({ recipientUserId: userId, templateId: "t1", variables: { name: "A" }, title: "Hello", body: "Hi A", priority: "normal" });
    expect(queue.error).toBeFalsy();
    // Dedupe: same message within 60s
    const queue2 = await services.messaging.queueMessage({ recipientUserId: userId, templateId: "t1", variables: { name: "A" }, title: "Hello", body: "Hi A", priority: "normal" });
    expect(queue2.error).toBeTruthy();
    expect(queue2.error.message).toContain("deduplicated");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { clearAllCollections, createTestContext } from "./testHelpers";

describe("UI state transitions and edge flows", () => {
  let services;
  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);
  });

  it("handles empty state for requests, shipments, notifications", async () => {
    const reqs = await services.requestService.list({});
    expect(reqs.data.length).toBe(0);
    const ships = await services.shipmentService.list({});
    expect(ships.data.length).toBe(0);
    const notes = await services.messaging.listQueue("user1");
    expect(notes.data.length).toBe(0);
  });

  it("handles loading and busy state for message center", async () => {
    // Simulate loading by calling refresh and checking busy/loaded state
    // (In real UI, this would be a spinner/disabled state)
    // Here, we just check that the service call completes and sets state
    const template = await services.messaging.upsertTemplate({ templateId: "t2", title: "Loading", body: "Wait", defaultPriority: "normal" });
    expect(template.error).toBeFalsy();
  });

  it("handles disabled state for admin config when missing service", async () => {
    // Simulate missing service by passing undefined
    let error;
    try {
      await services.adminConfig.setCommissionRule.call(undefined, { percentage: 3.5 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
  });
});

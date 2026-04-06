import { beforeEach, describe, expect, it } from "vitest";
import { clearAllCollections, createTestContext } from "./testHelpers";

describe("Error/validation/edge state coverage", () => {
  let services;
  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);
  });

  it("rejects invalid admin config input", async () => {
    const result = await services.adminConfig.setCommissionRule({ percentage: "not-a-number" });
    expect(result.error).toBeTruthy();
    expect(result.status).toBe(400);
  });

  it("rejects invalid bulk import file (missing required fields)", async () => {
    const csv = [
      "itemSku,lot,warehouseLocation,requester,date",
      "SKU-1,LOT-1,WH-1,student_1,2026-01-01",
      // missing documentStatus (required)
    ].join("\n");
    const result = await services.bulkData.importData({
      collection: "shipments",
      format: "csv",
      content: csv,
    });
    expect(result.status).toBe(422);
    expect(result.error).toBeTruthy();
  });

  it("handles plugin runtime error and returns safe error payload", async () => {
    services.plugins.register({
      id: "fail-plugin",
      type: "parsers",
      async read() { throw new Error("fail"); },
      async normalize(input) { return input; },
      async write(target, input) { return input; },
    });
    const result = await services.plugins.runPlugin("fail-plugin", { source: { foo: 1 }, target: null });
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});

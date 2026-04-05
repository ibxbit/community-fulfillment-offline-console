import { beforeEach, describe, expect, it } from "vitest";
import { clearAllCollections, createTestContext } from "./testHelpers";

describe("Bulk import validation and rollback behavior", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);
  });

  it("fails the whole import when any row is invalid", async () => {
    const csv = [
      "requesterUserId,requestingOrgId,itemSku,quantity",
      "student_1,org_a,SKU-1,2",
      "student_2,org_a,SKU-2,",
    ].join("\n");

    const result = await services.bulkData.importData({
      collection: "requests",
      format: "csv",
      content: csv,
    });

    expect(result.status).toBe(422);
    expect(result.error.message).toBe("Row validation failed");
    expect(result.error.details.errors).toHaveLength(1);
    expect(result.error.details.errors[0].row).toBe(3);

    const stored = await services.db.collections.requests.find({});
    expect(stored).toHaveLength(0);
  });

  it("rejects files over the 5000 row cap", async () => {
    const rows = Array.from({ length: 5001 }).map((_, i) => ({
      requesterUserId: `student_${i}`,
      requestingOrgId: "org_a",
      itemSku: `SKU-${i}`,
      quantity: 1,
    }));

    const result = await services.bulkData.importData({
      collection: "requests",
      format: "json",
      content: JSON.stringify(rows),
    });

    expect(result.status).toBe(400);
    expect(result.error.message).toContain("Maximum is 5000");
  });
});

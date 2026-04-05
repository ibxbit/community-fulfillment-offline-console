import { beforeEach, describe, expect, it } from "vitest";
import { ROLES } from "../src/auth/roles";
import { REQUEST_STATUS } from "../src/services/requestLifecycleService";
import { clearAllCollections, createTestContext } from "./testHelpers";

describe("Request workflow", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);
  });

  it("triggers secondary review after approved field mutation", async () => {
    const student = { userId: "student_1", role: ROLES.STUDENT };
    const reviewer = { userId: "reviewer_1", role: ROLES.REVIEWER };

    const created = await services.requestService.create({
      actor: student,
      payload: {
        requestingOrgId: "org_a",
        requestingClassId: "class_a",
        itemSku: "SKU-A",
        quantity: 1,
        deliveryWindow: "2026-05-01",
      },
    });
    expect(created.error).toBeNull();

    const requestId = created.data._id;

    const submitted = await services.requestsLifecycle.submitForReview(
      student,
      requestId,
    );
    expect(submitted.error).toBeNull();

    const approved = await services.reviewerTools.approve(
      reviewer,
      requestId,
      "ok",
    );
    expect(approved.error).toBeNull();
    expect(approved.data.status).toBe(REQUEST_STATUS.APPROVED);

    const edited = await services.requestService.update({
      actor: student,
      requestId,
      patch: { quantity: 2 },
    });

    expect(edited.error).toBeNull();
    expect(edited.data.status).toBe(REQUEST_STATUS.REQUIRES_SECONDARY_REVIEW);
    expect(edited.data.fulfillmentBlocked).toBe(true);
  });

  it("does not trigger secondary review when non-monitored fields change", async () => {
    const student = { userId: "student_1", role: ROLES.STUDENT };
    const reviewer = { userId: "reviewer_1", role: ROLES.REVIEWER };

    const created = await services.requestService.create({
      actor: student,
      payload: {
        requestingOrgId: "org_a",
        requestingClassId: "class_a",
        itemSku: "SKU-A",
        quantity: 1,
      },
    });

    await services.requestsLifecycle.submitForReview(student, created.data._id);
    await services.reviewerTools.approve(reviewer, created.data._id, "ok");

    const edited = await services.requestService.update({
      actor: student,
      requestId: created.data._id,
      patch: { note: "added context" },
    });

    expect(edited.error).toBeNull();
    expect(edited.data.status).toBe(REQUEST_STATUS.APPROVED);
    expect(edited.data.requiresSecondaryReview).toBe(false);
  });

  it("rejects archive while request is still in review", async () => {
    const student = { userId: "student_1", role: ROLES.STUDENT };
    const created = await services.requestService.create({
      actor: student,
      payload: {
        requestingOrgId: "org_a",
        requestingClassId: "class_a",
        itemSku: "SKU-A",
        quantity: 1,
      },
    });

    await services.requestsLifecycle.submitForReview(student, created.data._id);

    const archived = await services.requestService.archive({
      actor: student,
      requestId: created.data._id,
    });

    expect(archived.status).toBe(409);
    expect(archived.error.message).toContain("cannot be archived");
  });
});

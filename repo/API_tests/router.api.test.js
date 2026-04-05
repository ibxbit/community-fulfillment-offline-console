import { beforeEach, describe, expect, it } from "vitest";
import {
  hashPassword,
  PBKDF2_ITERATIONS,
  createSalt,
} from "../src/auth/crypto";
import { ROLES } from "../src/auth/roles";
import {
  clearAllCollections,
  createTestContext,
} from "../unit_tests/testHelpers";

async function seedUser(
  collection,
  { _id, username, password, role, orgScopeIds = [], classScopeIds = [] },
) {
  const passwordSalt = createSalt();
  const passwordHash = await hashPassword(
    password,
    passwordSalt,
    PBKDF2_ITERATIONS,
  );

  await collection.insertOne({
    _id,
    username,
    name: username,
    role,
    orgScopeIds,
    classScopeIds,
    passwordSalt,
    passwordHash,
    passwordIterations: PBKDF2_ITERATIONS,
  });
}

describe("Frontend API router contracts with auth guards", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);

    await seedUser(services.db.collections.users, {
      _id: "student_1",
      username: "student1",
      password: "pass123",
      role: ROLES.STUDENT,
      orgScopeIds: ["org_a"],
      classScopeIds: ["class_a"],
    });

    await seedUser(services.db.collections.users, {
      _id: "student_2",
      username: "student2",
      password: "pass123",
      role: ROLES.STUDENT,
      orgScopeIds: ["org_b"],
      classScopeIds: ["class_b"],
    });

    await seedUser(services.db.collections.users, {
      _id: "reviewer_1",
      username: "reviewer1",
      password: "pass123",
      role: ROLES.REVIEWER,
    });

    await seedUser(services.db.collections.users, {
      _id: "teacher_1",
      username: "teacher1",
      password: "pass123",
      role: ROLES.TEACHER,
      orgScopeIds: ["org_a"],
      classScopeIds: ["class_a"],
    });

    await seedUser(services.db.collections.users, {
      _id: "warehouse_1",
      username: "warehouse1",
      password: "pass123",
      role: ROLES.WAREHOUSE_STAFF,
    });

    await seedUser(services.db.collections.users, {
      _id: "ops_1",
      username: "ops1",
      password: "pass123",
      role: ROLES.OPERATIONS,
    });

    await seedUser(services.db.collections.users, {
      _id: "finance_1",
      username: "finance1",
      password: "pass123",
      role: ROLES.FINANCE,
    });

    await seedUser(services.db.collections.users, {
      _id: "admin_1",
      username: "admin1",
      password: "pass123",
      role: ROLES.ADMIN,
    });
  });

  async function login(username, password) {
    const response = await services.router.call("POST /auth/login", {
      username,
      password,
    });
    return response;
  }

  async function loginToken(username, password = "pass123") {
    const response = await login(username, password);
    expect(response.status).toBe(200);
    return response.data.token;
  }

  it("auth login success and failure", async () => {
    const success = await login("student1", "pass123");
    expect(success.status).toBe(200);
    expect(success.data.token).toBeTruthy();

    const fail = await login("student1", "wrong");
    expect(fail.status).toBe(401);
  });

  it("rejects unauthenticated access on protected routes", async () => {
    const response = await services.router.call("GET /audit/verify-chain", {});
    expect(response.status).toBe(401);
    expect(response.error.message).toContain("Authentication required");
  });

  it("rejects unauthorized role on shipment and admin routes", async () => {
    const finance = await login("finance1", "pass123");
    const shipment = await services.db.collections.shipments.insertOne({
      itemSku: "SKU-1",
      requester: "user_1",
      date: new Date().toISOString(),
    });

    const deniedShipment = await services.router.call(
      "POST /fulfillment/assign-carrier",
      {
        auth: { token: finance.data.token },
        actor: { userId: "finance_1", role: ROLES.FINANCE },
        shipmentId: shipment._id,
        carrier: "CarrierX",
        trackingNumber: "TRK-1",
      },
    );

    expect(deniedShipment.status).toBe(403);

    const deniedAdmin = await services.router.call(
      "POST /admin/service-areas",
      {
        auth: { token: finance.data.token },
        name: "Area A",
        locations: ["loc-1"],
      },
    );

    expect(deniedAdmin.status).toBe(403);
  });

  it("enforces object/scope isolation across users", async () => {
    const student1Token = await loginToken("student1");

    const created = await services.router.call("POST /requests/draft", {
      auth: { token: student1Token },
      actor: { userId: "student_1", role: ROLES.STUDENT },
      data: {
        requestingOrgId: "org_a",
        requestingClassId: "class_a",
        itemSku: "SKU-A",
        quantity: 1,
      },
    });

    expect(created.status).toBe(201);

    const student2Token = await loginToken("student2");

    const deniedUpdate = await services.router.call("PATCH /requests/draft", {
      auth: { token: student2Token },
      actor: { userId: "student_2", role: ROLES.STUDENT },
      requestId: created.data._id,
      patch: { quantity: 2 },
    });

    expect(deniedUpdate.status).toBe(403);
  });

  it("supports draft-submit-review-approve-archive flow", async () => {
    const studentToken = await loginToken("student1");

    const created = await services.router.call("POST /requests/draft", {
      auth: { token: studentToken },
      actor: { userId: "student_1", role: ROLES.STUDENT },
      data: {
        requestingOrgId: "org_a",
        requestingClassId: "class_a",
        itemSku: "SKU-A",
        quantity: 1,
      },
    });
    expect(created.status).toBe(201);

    const submitted = await services.router.call("POST /requests/submit", {
      auth: { token: studentToken },
      actor: { userId: "student_1", role: ROLES.STUDENT },
      requestId: created.data._id,
    });
    expect(submitted.status).toBe(200);

    const reviewerToken = await loginToken("reviewer1");

    const approved = await services.router.call(
      "POST /requests/review/approve",
      {
        auth: { token: reviewerToken },
        actor: { userId: "reviewer_1", role: ROLES.REVIEWER },
        requestId: created.data._id,
        comment: "ok",
      },
    );
    expect(approved.status).toBe(200);

    const studentTokenAfterReview = await loginToken("student1");

    const archived = await services.router.call("POST /requests/archive", {
      auth: { token: studentTokenAfterReview },
      actor: { userId: "student_1", role: ROLES.STUDENT },
      requestId: created.data._id,
    });
    expect(archived.status).toBe(200);
  });

  it("supports messaging dedupe and receipts", async () => {
    const studentToken = await loginToken("student1");

    const payload = {
      auth: { token: studentToken },
      recipientUserId: "student_1",
      title: "Hello",
      body: "Message",
      priority: "normal",
    };

    const first = await services.router.call("POST /messaging/queue", payload);
    const second = await services.router.call("POST /messaging/queue", payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(202);
    expect(second.data.reason).toBe("duplicate_within_60s");

    const delivered = await services.router.call(
      "POST /messaging/deliver-next",
      {
        auth: { token: studentToken },
        recipientUserId: "student_1",
      },
    );
    expect(delivered.status).toBe(200);

    const receipts = await services.router.call("GET /messaging/receipts", {
      auth: { token: studentToken },
      recipientUserId: "student_1",
    });
    expect(receipts.status).toBe(200);
    expect(receipts.data.length).toBeGreaterThan(0);
  });

  it("enforces RBAC boundaries across major resources by role", async () => {
    const shipment = await services.db.collections.shipments.insertOne({
      itemSku: "SKU-ROLE-1",
      requester: "student_1",
      date: new Date().toISOString(),
    });

    const studentToken = await loginToken("student1");

    const studentAdminWrite = await services.router.call(
      "POST /admin/service-areas",
      {
        auth: { token: studentToken },
        name: "Area Student",
        locations: ["x"],
      },
    );
    expect(studentAdminWrite.status).toBe(403);

    const teacherToken = await loginToken("teacher1");

    const teacherDraftCreate = await services.router.call(
      "POST /requests/draft",
      {
        auth: { token: teacherToken },
        actor: { userId: "teacher_1", role: ROLES.TEACHER },
        data: {
          requestingOrgId: "org_a",
          requestingClassId: "class_a",
          itemSku: "SKU-TEACH",
          quantity: 1,
        },
      },
    );
    expect(teacherDraftCreate.status).toBe(403);

    const reviewerToken = await loginToken("reviewer1");

    const reviewerDraftCreate = await services.router.call(
      "POST /requests/draft",
      {
        auth: { token: reviewerToken },
        actor: { userId: "reviewer_1", role: ROLES.REVIEWER },
        data: {
          requestingOrgId: "org_a",
          requestingClassId: "class_a",
          itemSku: "SKU-REV",
          quantity: 1,
        },
      },
    );
    expect(reviewerDraftCreate.status).toBe(403);

    const warehouseToken = await loginToken("warehouse1");

    const warehouseCarrierAssign = await services.router.call(
      "POST /fulfillment/assign-carrier",
      {
        auth: { token: warehouseToken },
        actor: { userId: "warehouse_1", role: ROLES.WAREHOUSE_STAFF },
        shipmentId: shipment._id,
        carrier: "CarrierW",
        trackingNumber: "TRK-W",
      },
    );
    expect(warehouseCarrierAssign.status).toBe(200);

    const financeToken = await loginToken("finance1");

    const financeQueueOtherUser = await services.router.call(
      "POST /messaging/queue",
      {
        auth: { token: financeToken },
        recipientUserId: "student_1",
        title: "N",
        body: "B",
      },
    );
    expect(financeQueueOtherUser.status).toBe(403);

    const operationsToken = await loginToken("ops1");

    const operationsQueueOtherUser = await services.router.call(
      "POST /messaging/queue",
      {
        auth: { token: operationsToken },
        recipientUserId: "student_1",
        title: "Ops",
        body: "Message",
      },
    );
    expect(operationsQueueOtherUser.status).toBe(201);

    const adminToken = await loginToken("admin1");

    const adminAudit = await services.router.call("GET /audit/verify-chain", {
      auth: { token: adminToken },
    });
    expect(adminAudit.status ?? 200).toBe(200);
    expect((adminAudit.data ?? adminAudit).valid).toBe(true);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { ROLES } from "../src/auth/roles";
import { maskSensitiveFields, maskSensitiveValue } from "../src/auth/masking";
import {
  hashPassword,
  PBKDF2_ITERATIONS,
  createSalt,
} from "../src/auth/crypto";
import { clearAllCollections, createTestContext } from "./testHelpers";

async function seedUser(collection, { _id, username, password, role }) {
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
    passwordSalt,
    passwordHash,
    passwordIterations: PBKDF2_ITERATIONS,
    orgScopeIds: ["org_a"],
    classScopeIds: ["class_a"],
  });
}

describe("RBAC and audit integrity", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);
  });

  it("enforces role check on shipment carrier assignment", async () => {
    const shipment = await services.db.collections.shipments.insertOne({
      itemSku: "SKU-1",
      requester: "student_1",
      date: new Date().toISOString(),
    });

    const denied = await services.shipmentService.assignCarrier({
      actor: { userId: "finance_1", role: ROLES.FINANCE },
      shipmentId: shipment._id,
      carrier: "CarrierX",
      trackingNumber: "TRK1",
    });

    expect(denied.status).toBe(403);
  });

  it("detects tampering in hash-chained audit logs", async () => {
    await services.users.create({
      username: "u1",
      name: "U1",
      role: "Student",
    });
    await services.users.create({
      username: "u2",
      name: "U2",
      role: "Student",
    });

    const before = await services.auditTrail.verifyChain();
    expect(before.valid).toBe(true);

    const firstLog = await services.db.collections.audit_logs.findOne({
      sequence: 1,
    });
    await services.db.collections.audit_logs.updateOne(
      { _id: firstLog._id },
      { ...firstLog, metadata: { hacked: true } },
    );

    const after = await services.auditTrail.verifyChain();
    expect(after.valid).toBe(false);
    expect(after.issues.length).toBeGreaterThan(0);
  });

  it("masks sensitive fields before writing audit metadata", async () => {
    const token = "very-secret-token";
    await services.auditTrail.append({
      action: "security_event",
      resourceType: "auth",
      resourceId: "auth_1",
      metadata: {
        token,
        nested: { password: "hidden" },
      },
    });

    const first = await services.db.collections.audit_logs.findOne({
      sequence: 1,
    });
    expect(first.metadata.token).not.toBe(token);
    expect(first.metadata.nested.password).toContain("*");

    const chain = await services.auditTrail.verifyChain();
    expect(chain.valid).toBe(true);
  });

  it("blocks privilege escalation via forged actor payload", async () => {
    await seedUser(services.db.collections.users, {
      _id: "student_1",
      username: "student1",
      password: "pass123",
      role: ROLES.STUDENT,
    });

    const login = await services.router.call("POST /auth/login", {
      username: "student1",
      password: "pass123",
    });

    const attempt = await services.router.call("POST /requests/draft", {
      auth: { token: login.data.token },
      actor: { userId: "admin_1", role: ROLES.ADMIN },
      data: {
        requestingOrgId: "org_a",
        requestingClassId: "class_a",
        itemSku: "SKU-A",
        quantity: 1,
      },
    });

    expect(attempt.status).toBe(403);
  });

  it("masks values for UI-safe rendering", () => {
    expect(maskSensitiveValue("1234567890", 2, 2)).toBe("12******90");

    const masked = maskSensitiveFields({
      apiKey: "ABCDEF123",
      profile: { password: "pass123" },
      plain: "ok",
    });

    expect(masked.apiKey).toContain("*");
    expect(masked.profile.password).toContain("*");
    expect(masked.plain).toBe("ok");
  });
});

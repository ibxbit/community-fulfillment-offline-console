import { beforeEach, describe, expect, it } from "vitest";
import { ROLES } from "../src/auth/roles";
import {
  createApiTestContext,
  clearAll,
  seedAllUsers,
  loginAs,
  SEED_USERS,
} from "./apiTestHelpers";

describe("POST /auth/logout", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createApiTestContext());
    await clearAll(services);
    await seedAllUsers(services);
  });

  it("logs out successfully and returns body", async () => {
    const token = await loginAs(services, "student1");

    const result = await services.router.call("POST /auth/logout", {
      auth: { token },
    });

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ loggedOut: true });
  });

  it("invalidates session after logout", async () => {
    const token = await loginAs(services, "student1");

    await services.router.call("POST /auth/logout", {
      auth: { token },
    });

    const afterLogout = await services.router.call("POST /auth/keepalive", {
      auth: { token },
    });

    expect(afterLogout.status).toBe(401);
  });

  it("rejects logout with invalid token", async () => {
    const result = await services.router.call("POST /auth/logout", {
      auth: { token: "bad-token" },
    });

    expect(result.status).toBe(401);
    expect(result.error.message).toBeTruthy();
  });

  it("rejects unauthenticated logout", async () => {
    const result = await services.router.call("POST /auth/logout", {});

    expect(result.status).toBe(401);
  });
});

describe("POST /auth/keepalive", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createApiTestContext());
    await clearAll(services);
    await seedAllUsers(services);
  });

  it("returns keepalive confirmation with lastActivityAt", async () => {
    const token = await loginAs(services, "student1");

    const result = await services.router.call("POST /auth/keepalive", {
      auth: { token },
    });

    expect(result.status).toBe(200);
    expect(result.data.keepalive).toBe(true);
    expect(result.data.lastActivityAt).toBeTruthy();
  });

  it("rejects keepalive with invalid token", async () => {
    const result = await services.router.call("POST /auth/keepalive", {
      auth: { token: "invalid-token" },
    });

    expect(result.status).toBe(401);
    expect(result.error.message).toBeTruthy();
  });

  it("rejects unauthenticated keepalive", async () => {
    const result = await services.router.call("POST /auth/keepalive", {});

    expect(result.status).toBe(401);
  });

  it("rejects keepalive after logout", async () => {
    const token = await loginAs(services, "student1");

    await services.router.call("POST /auth/logout", {
      auth: { token },
    });

    const result = await services.router.call("POST /auth/keepalive", {
      auth: { token },
    });

    expect(result.status).toBe(401);
  });
});

describe("POST /auth/change-password", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createApiTestContext());
    await clearAll(services);
    await seedAllUsers(services);
  });

  it("changes own password successfully", async () => {
    const token = await loginAs(services, "student1");

    const result = await services.router.call("POST /auth/change-password", {
      auth: { token },
      currentPassword: "pass123",
      newPassword: "newpass456",
    });

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ changed: true });

    // verify new password works
    const loginResult = await services.router.call("POST /auth/login", {
      username: "student1",
      password: "newpass456",
    });
    expect(loginResult.status).toBe(200);
  });

  it("rejects invalid current password", async () => {
    const token = await loginAs(services, "student1");

    const result = await services.router.call("POST /auth/change-password", {
      auth: { token },
      currentPassword: "wrongpassword",
      newPassword: "newpass456",
    });

    expect(result.status).toBe(401);
    expect(result.error.message).toContain("Current password");
  });

  it("rejects password shorter than 6 characters", async () => {
    const token = await loginAs(services, "student1");

    const result = await services.router.call("POST /auth/change-password", {
      auth: { token },
      currentPassword: "pass123",
      newPassword: "short",
    });

    expect(result.status).toBe(400);
    expect(result.error.message).toContain("at least 6 characters");
  });

  it("rejects unauthenticated request with structured error", async () => {
    const result = await services.router.call("POST /auth/change-password", {
      currentPassword: "pass123",
      newPassword: "newpass456",
    });

    expect(result.status).toBe(401);
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.error.message).toBe("Authentication required");
  });

  it("admin can change another user's password", async () => {
    const adminToken = await loginAs(services, "admin1");

    const result = await services.router.call("POST /auth/change-password", {
      auth: { token: adminToken },
      targetUserId: "student_1",
      newPassword: "adminreset1",
    });

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ changed: true });

    // verify the new password works for the student
    const loginResult = await services.router.call("POST /auth/login", {
      username: "student1",
      password: "adminreset1",
    });
    expect(loginResult.status).toBe(200);
  });

  it("non-admin cannot change another user's password", async () => {
    const token = await loginAs(services, "student1");

    const result = await services.router.call("POST /auth/change-password", {
      auth: { token },
      targetUserId: "student_2",
      newPassword: "hackerpass",
    });

    expect(result.status).toBe(403);
    expect(result.error.message).toContain("Not allowed");
  });
});

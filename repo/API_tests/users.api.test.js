import { beforeEach, describe, expect, it } from "vitest";
import { ROLES } from "../src/auth/roles";
import {
  createApiTestContext,
  clearAll,
  seedAllUsers,
  loginAs,
} from "./apiTestHelpers";

describe("GET /users", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createApiTestContext());
    await clearAll(services);
    await seedAllUsers(services);
  });

  it("admin can list users", async () => {
    const token = await loginAs(services, "admin1");

    const result = await services.router.call("GET /users", {
      auth: { token },
    });

    expect(result.status).toBe(200);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(8);
  });

  it("rejects unauthenticated request", async () => {
    const result = await services.router.call("GET /users", {});

    expect(result.status).toBe(401);
  });

  it("rejects unauthorized role (student has no users:read)", async () => {
    const token = await loginAs(services, "student1");

    const result = await services.router.call("GET /users", {
      auth: { token },
    });

    expect(result.status).toBe(403);
    expect(result.error.message).toContain("Permission denied");
  });

  it("supports query filters", async () => {
    const token = await loginAs(services, "admin1");

    const result = await services.router.call("GET /users", {
      auth: { token },
      query: { role: ROLES.STUDENT },
    });

    expect(result.status).toBe(200);
    expect(Array.isArray(result.data)).toBe(true);
  });
});

describe("POST /users", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createApiTestContext());
    await clearAll(services);
    await seedAllUsers(services);
  });

  it("admin can create a user", async () => {
    const token = await loginAs(services, "admin1");

    const result = await services.router.call("POST /users", {
      auth: { token },
      username: "newuser",
      name: "New User",
      role: ROLES.STUDENT,
    });

    expect(result.status).toBe(201);
    expect(result.data).toBeTruthy();
    expect(result.data.username).toBe("newuser");
    expect(result.data.name).toBe("New User");
    expect(result.data.role).toBe(ROLES.STUDENT);
    expect(result.data._id).toBeTruthy();
  });

  it("rejects unauthenticated request with structured error", async () => {
    const result = await services.router.call("POST /users", {
      username: "newuser",
      name: "New User",
      role: ROLES.STUDENT,
    });

    expect(result.status).toBe(401);
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.error.message).toBe("Authentication required");
  });

  it("rejects unauthorized role (student) with structured 403", async () => {
    const token = await loginAs(services, "student1");

    const result = await services.router.call("POST /users", {
      auth: { token },
      username: "newuser",
      name: "New User",
      role: ROLES.STUDENT,
    });

    expect(result.status).toBe(403);
    expect(result.data).toBeNull();
    expect(result.error.message).toBe("Permission denied");
  });

  it("rejects unauthorized role (operations) with structured 403", async () => {
    const token = await loginAs(services, "ops1");

    const result = await services.router.call("POST /users", {
      auth: { token },
      username: "newuser",
      name: "New User",
      role: ROLES.STUDENT,
    });

    expect(result.status).toBe(403);
    expect(result.data).toBeNull();
    expect(result.error.message).toBe("Permission denied");
  });

  it("created user persists in the users collection", async () => {
    const token = await loginAs(services, "admin1");

    const created = await services.router.call("POST /users", {
      auth: { token },
      username: "persistent_user",
      name: "Persistent User",
      role: ROLES.TEACHER,
    });

    expect(created.status).toBe(201);

    const listResult = await services.router.call("GET /users", {
      auth: { token },
    });

    const found = listResult.data.find(
      (u) => u.username === "persistent_user",
    );
    expect(found).toBeTruthy();
    expect(found.role).toBe(ROLES.TEACHER);
  });
});

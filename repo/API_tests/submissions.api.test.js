import { beforeEach, describe, expect, it } from "vitest";
import { ROLES } from "../src/auth/roles";
import {
  createApiTestContext,
  clearAll,
  seedAllUsers,
  loginAs,
} from "./apiTestHelpers";

describe("GET /submissions", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createApiTestContext());
    await clearAll(services);
    await seedAllUsers(services);
  });

  it("authorized user can list submissions", async () => {
    const token = await loginAs(services, "student1");

    const result = await services.router.call("GET /submissions", {
      auth: { token },
    });

    expect(result.status).toBe(200);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBe(0);
  });

  it("returns submissions after one is created", async () => {
    const adminToken = await loginAs(services, "admin1");

    await services.router.call("POST /submissions", {
      auth: { token: adminToken },
      title: "Test Submission",
      content: "Body text",
    });

    const studentToken = await loginAs(services, "student1");
    const result = await services.router.call("GET /submissions", {
      auth: { token: studentToken },
    });

    expect(result.status).toBe(200);
    expect(result.data.length).toBe(1);
    expect(result.data[0].title).toBe("Test Submission");
  });

  it("rejects unauthenticated request", async () => {
    const result = await services.router.call("GET /submissions", {});
    expect(result.status).toBe(401);
  });

  it("rejects roles without requests:read permission", async () => {
    const token = await loginAs(services, "finance1");

    const result = await services.router.call("GET /submissions", {
      auth: { token },
    });

    expect(result.status).toBe(403);
  });
});

describe("POST /submissions", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createApiTestContext());
    await clearAll(services);
    await seedAllUsers(services);
  });

  it("authorized user can create a submission", async () => {
    const token = await loginAs(services, "student1");

    const result = await services.router.call("POST /submissions", {
      auth: { token },
      title: "New Submission",
      content: "Submission content",
    });

    expect(result.status).toBe(201);
    expect(result.data).toBeTruthy();
    expect(result.data._id).toBeTruthy();
    expect(result.data.title).toBe("New Submission");
  });

  it("rejects unauthenticated request", async () => {
    const result = await services.router.call("POST /submissions", {
      title: "No Auth",
      content: "Body",
    });

    expect(result.status).toBe(401);
  });

  it("rejects roles without requests:create permission", async () => {
    const token = await loginAs(services, "finance1");

    const result = await services.router.call("POST /submissions", {
      auth: { token },
      title: "Denied",
      content: "Body",
    });

    expect(result.status).toBe(403);
  });

  it("persists submission and returns it in list", async () => {
    const token = await loginAs(services, "student1");

    const created = await services.router.call("POST /submissions", {
      auth: { token },
      title: "Persist Test",
      content: "Should persist",
    });

    expect(created.status).toBe(201);

    const list = await services.router.call("GET /submissions", {
      auth: { token },
    });

    expect(list.data.some((s) => s._id === created.data._id)).toBe(true);
  });
});

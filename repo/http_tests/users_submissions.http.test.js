import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestServer,
  seedAllUsers,
  clearAll,
  httpLogin,
  httpRequest,
} from "./testHttpServer.js";

describe("Users & Submissions HTTP integration tests", () => {
  let ctx, base;

  beforeAll(async () => {
    ctx = await createTestServer();
    await ctx.start();
    base = ctx.baseUrl();
  });

  afterAll(async () => { await ctx.stop(); });

  beforeEach(async () => {
    await clearAll(ctx.services);
    await seedAllUsers(ctx.services);
  });

  // ── GET /users ──

  describe("GET /users", () => {
    it("200 — admin lists users with body shape", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "GET", "/users", null, token);

      expect(res.httpStatus).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(7);
      expect(res.data[0]._id).toBeTruthy();
    });

    it("401 — unauthenticated", async () => {
      const res = await httpRequest(base, "GET", "/users");
      expect(res.httpStatus).toBe(401);
      expect(res.error.message).toBe("Authentication required");
    });

    it("403 — student lacks users:read", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "GET", "/users", null, token);
      expect(res.httpStatus).toBe(403);
      expect(res.error.message).toBe("Permission denied");
    });
  });

  // ── POST /users ──

  describe("POST /users", () => {
    it("201 — admin creates user", async () => {
      const token = await httpLogin(base, "admin1");
      const res = await httpRequest(base, "POST", "/users", {
        username: "newuser", name: "New User", role: "Student",
      }, token);

      expect(res.httpStatus).toBe(201);
      expect(res.data._id).toBeTruthy();
      expect(res.data.username).toBe("newuser");
    });

    it("401 — unauthenticated", async () => {
      const res = await httpRequest(base, "POST", "/users", { username: "x", name: "X", role: "Student" });
      expect(res.httpStatus).toBe(401);
    });

    it("403 — student lacks users:manage", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/users", { username: "x", name: "X", role: "Student" }, token);
      expect(res.httpStatus).toBe(403);
    });
  });

  // ── GET /submissions ──

  describe("GET /submissions", () => {
    it("200 — returns list", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "GET", "/submissions", null, token);
      expect(res.httpStatus).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it("401 — unauthenticated", async () => {
      const res = await httpRequest(base, "GET", "/submissions");
      expect(res.httpStatus).toBe(401);
    });

    it("403 — finance lacks requests:read", async () => {
      const token = await httpLogin(base, "finance1");
      const res = await httpRequest(base, "GET", "/submissions", null, token);
      expect(res.httpStatus).toBe(403);
    });
  });

  // ── POST /submissions ──

  describe("POST /submissions", () => {
    it("201 — creates submission", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/submissions", {
        title: "Test", content: "Body",
      }, token);

      expect(res.httpStatus).toBe(201);
      expect(res.data._id).toBeTruthy();
      expect(res.data.title).toBe("Test");
    });

    it("401 — unauthenticated", async () => {
      const res = await httpRequest(base, "POST", "/submissions", { title: "X" });
      expect(res.httpStatus).toBe(401);
    });
  });

  // ── GET /fulfillments ──

  describe("GET /fulfillments", () => {
    it("200 — warehouse can list", async () => {
      const token = await httpLogin(base, "warehouse1");
      const res = await httpRequest(base, "GET", "/fulfillments", null, token);
      expect(res.httpStatus).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it("403 — student denied", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "GET", "/fulfillments", null, token);
      expect(res.httpStatus).toBe(403);
    });
  });

  // ── POST /fulfillments ──

  describe("POST /fulfillments", () => {
    it("201 — warehouse creates", async () => {
      const token = await httpLogin(base, "warehouse1");
      const res = await httpRequest(base, "POST", "/fulfillments", { itemSku: "SKU-F1" }, token);
      expect(res.httpStatus).toBe(201);
      expect(res.data.itemSku).toBe("SKU-F1");
    });

    it("403 — student denied", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/fulfillments", { itemSku: "X" }, token);
      expect(res.httpStatus).toBe(403);
    });
  });
});

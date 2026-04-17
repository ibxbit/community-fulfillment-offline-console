import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestServer,
  seedAllUsers,
  clearAll,
  httpLogin,
  httpRequest,
} from "./testHttpServer.js";

describe("Auth HTTP integration tests", () => {
  let ctx;
  let base;

  beforeAll(async () => {
    ctx = await createTestServer();
    await ctx.start();
    base = ctx.baseUrl();
  });

  afterAll(async () => {
    await ctx.stop();
  });

  beforeEach(async () => {
    await clearAll(ctx.services);
    await seedAllUsers(ctx.services);
  });

  // ── POST /auth/login ──

  describe("POST /auth/login", () => {
    it("returns 200 with token and user on valid credentials", async () => {
      const res = await httpRequest(base, "POST", "/auth/login", {
        username: "student1",
        password: "pass123",
      });

      expect(res.httpStatus).toBe(200);
      expect(res.status).toBe(200);
      expect(res.data.token).toBeTruthy();
      expect(typeof res.data.token).toBe("string");
      expect(res.data.user._id).toBe("student_1");
      expect(res.data.user.role).toBe("Student");
      expect(res.error).toBeNull();
    });

    it("returns 401 with error payload on wrong password", async () => {
      const res = await httpRequest(base, "POST", "/auth/login", {
        username: "student1",
        password: "wrong",
      });

      expect(res.httpStatus).toBe(401);
      expect(res.data).toBeNull();
      expect(res.error).toBeTruthy();
      expect(res.error.message).toContain("Invalid");
    });

    it("returns 400 for missing credentials", async () => {
      const res = await httpRequest(base, "POST", "/auth/login", {
        username: "",
        password: "",
      });

      expect(res.httpStatus).toBe(400);
      expect(res.error.message).toContain("required");
    });
  });

  // ── POST /auth/logout ──

  describe("POST /auth/logout", () => {
    it("returns 200 with loggedOut body on valid session", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/auth/logout", {}, token);

      expect(res.httpStatus).toBe(200);
      expect(res.data).toEqual({ loggedOut: true });
    });

    it("invalidates session after logout", async () => {
      const token = await httpLogin(base, "student1");
      await httpRequest(base, "POST", "/auth/logout", {}, token);

      const res = await httpRequest(base, "POST", "/auth/keepalive", {}, token);
      expect(res.httpStatus).toBe(401);
    });

    it("returns 401 when unauthenticated", async () => {
      const res = await httpRequest(base, "POST", "/auth/logout");
      expect(res.httpStatus).toBe(401);
    });
  });

  // ── POST /auth/keepalive ──

  describe("POST /auth/keepalive", () => {
    it("returns 200 with keepalive and lastActivityAt", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(base, "POST", "/auth/keepalive", {}, token);

      expect(res.httpStatus).toBe(200);
      expect(res.data.keepalive).toBe(true);
      expect(res.data.lastActivityAt).toBeTruthy();
    });

    it("returns 401 when unauthenticated", async () => {
      const res = await httpRequest(base, "POST", "/auth/keepalive");
      expect(res.httpStatus).toBe(401);
    });
  });

  // ── POST /auth/change-password ──

  describe("POST /auth/change-password", () => {
    it("returns 200 and changed:true on success", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(
        base,
        "POST",
        "/auth/change-password",
        { currentPassword: "pass123", newPassword: "newpass456" },
        token,
      );

      expect(res.httpStatus).toBe(200);
      expect(res.data).toEqual({ changed: true });
    });

    it("rejects with 401 for wrong current password", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(
        base,
        "POST",
        "/auth/change-password",
        { currentPassword: "wrong", newPassword: "newpass456" },
        token,
      );

      expect(res.httpStatus).toBe(401);
      expect(res.error.message).toContain("Current password");
    });

    it("rejects with 400 for short password", async () => {
      const token = await httpLogin(base, "student1");
      const res = await httpRequest(
        base,
        "POST",
        "/auth/change-password",
        { currentPassword: "pass123", newPassword: "ab" },
        token,
      );

      expect(res.httpStatus).toBe(400);
    });

    it("rejects unauthenticated", async () => {
      const res = await httpRequest(base, "POST", "/auth/change-password", {
        currentPassword: "pass123",
        newPassword: "newpass456",
      });
      expect(res.httpStatus).toBe(401);
    });
  });
});

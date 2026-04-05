import { beforeEach, describe, expect, it } from "vitest";
import {
  hashPassword,
  PBKDF2_ITERATIONS,
  createSalt,
} from "../src/auth/crypto";
import { ROLES } from "../src/auth/roles";
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
    orgScopeIds: [],
    classScopeIds: [],
  });
}

describe("Auth API and router guards", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);

    await seedUser(services.db.collections.users, {
      _id: "student_1",
      username: "student1",
      password: "pass123",
      role: ROLES.STUDENT,
    });
  });

  it("supports login keepalive logout lifecycle", async () => {
    const login = await services.router.call("POST /auth/login", {
      username: "student1",
      password: "pass123",
    });
    expect(login.status).toBe(200);

    const keepalive = await services.router.call("POST /auth/keepalive", {
      auth: { token: login.data.token },
    });
    expect(keepalive.status).toBe(200);

    const logout = await services.router.call("POST /auth/logout", {
      auth: { token: login.data.token },
    });
    expect(logout.status).toBe(200);

    const denied = await services.router.call("POST /auth/keepalive", {
      auth: { token: login.data.token },
    });
    expect(denied.status).toBe(401);
  });

  it("rejects protected route when unauthenticated", async () => {
    const response = await services.router.call("GET /messaging/templates", {});
    expect(response.status).toBe(401);
  });

  it("auto-locks a stale session after 15 minutes idle", async () => {
    const login = await services.router.call("POST /auth/login", {
      username: "student1",
      password: "pass123",
    });
    expect(login.status).toBe(200);

    const session = await services.db.collections.sessions.findOne({
      _id: "active",
    });
    await services.db.collections.sessions.updateOne(
      { _id: "active" },
      {
        ...session,
        lastActivityAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
      },
    );

    const stale = await services.router.call("GET /messaging/templates", {
      auth: { token: login.data.token },
    });
    expect(stale.status).toBe(401);

    const locked = await services.db.collections.sessions.findOne({
      _id: "active",
    });
    expect(locked.lockReason).toBe("inactivity_timeout");
    expect(locked.lockedAt).toBeTruthy();
  });

  it("blocks login after repeated failed attempts", async () => {
    for (let i = 0; i < 5; i += 1) {
      const failed = await services.router.call("POST /auth/login", {
        username: "student1",
        password: "wrong-password",
      });
      expect(failed.status).toBe(401);
    }

    const locked = await services.router.call("POST /auth/login", {
      username: "student1",
      password: "pass123",
    });
    expect(locked.status).toBe(429);
  });
});

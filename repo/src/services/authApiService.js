import { fail, ok } from "./response";
import { createAuthService } from "../auth/authService";
import { ROLES } from "../auth/roles";

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

function nowMs() {
  return Date.now();
}

function toIso(ms) {
  return new Date(ms).toISOString();
}

function loginAttemptKey(username) {
  return `login_attempt:${username.toLowerCase()}`;
}

export function createAuthApiService(collections) {
  const authService = createAuthService(collections);

  async function getAttemptRecord(username) {
    if (!username) {
      return null;
    }

    return collections.sessions.findOne({ _id: loginAttemptKey(username) });
  }

  async function clearFailedAttempts(username) {
    if (!username) {
      return;
    }

    await collections.sessions.deleteOne({ _id: loginAttemptKey(username) });
  }

  async function registerFailedAttempt(username) {
    const currentMs = nowMs();
    const existing = await getAttemptRecord(username);
    const recentFailures = (existing?.failedAttempts ?? []).filter(
      (ts) => currentMs - ts <= ATTEMPT_WINDOW_MS,
    );
    const nextFailures = [...recentFailures, currentMs];
    const shouldLock = nextFailures.length >= MAX_FAILED_ATTEMPTS;

    const record = {
      _id: loginAttemptKey(username),
      username: username.toLowerCase(),
      failedAttempts: nextFailures,
      lockUntil: shouldLock ? toIso(currentMs + LOCKOUT_MS) : null,
      updatedAt: toIso(currentMs),
    };

    const updated = await collections.sessions.updateOne(
      { _id: record._id },
      record,
    );
    if (!updated) {
      await collections.sessions.insertOne(record);
    }

    return record;
  }

  async function isTemporarilyLocked(username) {
    const record = await getAttemptRecord(username);
    if (!record?.lockUntil) {
      return false;
    }

    return Date.parse(record.lockUntil) > nowMs();
  }

  async function resolveUserFromToken(token) {
    if (!token) {
      return null;
    }

    const session = await authService.getSessionByToken(token);
    if (!session) {
      return null;
    }

    const restored = await authService.restoreSession(SESSION_TIMEOUT_MS);
    if (!restored || restored.session.token !== token) {
      return null;
    }

    return restored.user;
  }

  return {
    async authenticate(payload = {}) {
      const token = payload?.auth?.token ?? payload?.token ?? null;
      return resolveUserFromToken(token);
    },

    async login(payload) {
      const username = String(payload?.username ?? "").trim();
      const password = String(payload?.password ?? "");

      if (!username || !password) {
        return fail("username and password are required", 400);
      }

      if (await isTemporarilyLocked(username)) {
        return fail("Too many failed attempts. Try again later.", 429);
      }

      const result = await authService.signIn({ username, password });
      if (!result) {
        await registerFailedAttempt(username);
        return fail("Invalid credentials", 401);
      }

      await clearFailedAttempts(username);

      return ok({
        token: result.session.token,
        user: result.user,
      });
    },

    async logout(payload) {
      const token = payload?.auth?.token ?? payload?.token ?? null;
      const session = await authService.getSessionByToken(token);
      if (!session) {
        return fail("Invalid session", 401);
      }

      await authService.signOut();
      return ok({ loggedOut: true });
    },

    async keepalive(payload) {
      const token = payload?.auth?.token ?? payload?.token ?? null;
      const session = await authService.getSessionByToken(token);
      if (!session) {
        return fail("Invalid session", 401);
      }

      const touched = await authService.touchSession();
      if (!touched) {
        return fail("Session unavailable", 401);
      }

      return ok({ keepalive: true, lastActivityAt: touched.lastActivityAt });
    },

    async changePassword(payload) {
      const token = payload?.auth?.token ?? payload?.token ?? null;
      const actor = await resolveUserFromToken(token);
      if (!actor) {
        return fail("Invalid session", 401);
      }

      const newPassword = String(payload?.newPassword ?? "");
      const currentPassword = String(payload?.currentPassword ?? "");
      const targetUserId = payload?.targetUserId ?? actor._id;

      if (!newPassword || newPassword.length < 6) {
        return fail("newPassword must be at least 6 characters", 400);
      }

      const isSelf = targetUserId === actor._id;
      const isAdmin = actor.role === ROLES.ADMIN;
      if (!isSelf && !isAdmin) {
        return fail("Not allowed to change another user's password", 403);
      }

      const changed = await authService.changePassword({
        userId: targetUserId,
        currentPassword,
        newPassword,
        force: isAdmin && !isSelf,
      });

      if (changed === null) {
        return fail("User not found", 404);
      }

      if (changed === false) {
        return fail("Current password is invalid", 401);
      }

      return ok({ changed: true });
    },
  };
}

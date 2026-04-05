import { ROLES } from "./roles";
import { createId } from "../utils/id";
import {
  createSalt,
  hashPassword,
  PBKDF2_ITERATIONS,
  verifyPassword,
} from "./crypto";

const SESSION_KEY = "active";

function nowIso() {
  return new Date().toISOString();
}

function isExpired(session, timeoutMs) {
  if (!session?.lastActivityAt) {
    return false;
  }

  return Date.now() - Date.parse(session.lastActivityAt) > timeoutMs;
}

export function createAuthService(collections) {
  async function ensureDefaultAdmin() {
    const existing = await collections.users.findOne({ username: "admin" });
    if (existing) {
      return existing;
    }

    const passwordSalt = createSalt();
    const passwordHash = await hashPassword(
      "admin",
      passwordSalt,
      PBKDF2_ITERATIONS,
    );

    return collections.users.insertOne({
      username: "admin",
      name: "System Administrator",
      role: ROLES.ADMIN,
      orgScopeIds: [],
      classScopeIds: [],
      passwordHash,
      passwordSalt,
      passwordIterations: PBKDF2_ITERATIONS,
    });
  }

  async function writeSession(userId) {
    const nextSession = {
      _id: SESSION_KEY,
      userId,
      token: createId("session"),
      lastActivityAt: nowIso(),
      lockedAt: null,
    };

    const updated = await collections.sessions.updateOne(
      { _id: SESSION_KEY },
      nextSession,
    );
    if (updated) {
      return updated;
    }

    return collections.sessions.insertOne(nextSession);
  }

  async function getActiveSession() {
    return collections.sessions.findOne({ _id: SESSION_KEY });
  }

  async function verifySessionToken(token) {
    const session = await getActiveSession();
    if (!session || !token || session.token !== token) {
      return null;
    }

    return session;
  }

  return {
    async restoreSession(timeoutMs) {
      await ensureDefaultAdmin();
      const session = await collections.sessions.findOne({ _id: SESSION_KEY });
      if (!session || session.lockedAt) {
        return null;
      }

      if (isExpired(session, timeoutMs)) {
        await this.lockSession("inactivity_timeout");
        return null;
      }

      const user = await collections.users.findOne({ _id: session.userId });
      if (!user) {
        await this.signOut();
        return null;
      }

      return { user, session };
    },

    async signIn({ username, password }) {
      await ensureDefaultAdmin();
      const user = await collections.users.findOne({ username });
      if (!user) {
        return null;
      }

      const valid = await verifyPassword(
        password,
        user.passwordHash,
        user.passwordSalt,
        user.passwordIterations ?? PBKDF2_ITERATIONS,
      );

      if (!valid) {
        return null;
      }

      const session = await writeSession(user._id);
      return { user, session };
    },

    async touchSession() {
      const current = await collections.sessions.findOne({ _id: SESSION_KEY });
      if (!current || current.lockedAt) {
        return null;
      }

      return collections.sessions.updateOne(
        { _id: SESSION_KEY },
        {
          ...current,
          lastActivityAt: nowIso(),
        },
      );
    },

    async lockSession(reason = "manual_lock") {
      const current = await collections.sessions.findOne({ _id: SESSION_KEY });
      if (!current) {
        return null;
      }

      return collections.sessions.updateOne(
        { _id: SESSION_KEY },
        {
          ...current,
          lockReason: reason,
          lockedAt: nowIso(),
        },
      );
    },

    async signOut() {
      await collections.sessions.deleteOne({ _id: SESSION_KEY });
      return true;
    },

    async getSessionByToken(token) {
      return verifySessionToken(token);
    },

    async changePassword({
      userId,
      currentPassword,
      newPassword,
      force = false,
    }) {
      const user = await collections.users.findOne({ _id: userId });
      if (!user) {
        return null;
      }

      if (!force) {
        const valid = await verifyPassword(
          currentPassword,
          user.passwordHash,
          user.passwordSalt,
          user.passwordIterations ?? PBKDF2_ITERATIONS,
        );

        if (!valid) {
          return false;
        }
      }

      const passwordSalt = createSalt();
      const passwordHash = await hashPassword(
        newPassword,
        passwordSalt,
        PBKDF2_ITERATIONS,
      );

      return collections.users.updateOne(
        { _id: userId },
        {
          ...user,
          passwordSalt,
          passwordHash,
          passwordIterations: PBKDF2_ITERATIONS,
        },
      );
    },
  };
}

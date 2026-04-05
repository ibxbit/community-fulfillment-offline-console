import { createAuthService } from "./authService";
import { canAccessResource, hasPermission } from "./rbac";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_SYNC_THROTTLE_MS = 30 * 1000;
const LOCK_CHECK_INTERVAL_MS = 15 * 1000;

export function createAuthController(services) {
  const authService = createAuthService(services.db.collections);

  const state = {
    currentUser: null,
    lastActivityMs: 0,
    lastSyncedMs: 0,
    lockMonitorId: null,
    subscribers: new Set(),
  };

  function notify() {
    for (const listener of state.subscribers) {
      listener(state.currentUser);
    }
  }

  function stopLockMonitor() {
    if (state.lockMonitorId) {
      clearInterval(state.lockMonitorId);
      state.lockMonitorId = null;
    }
  }

  function startLockMonitor() {
    if (state.lockMonitorId) {
      return;
    }

    state.lockMonitorId = setInterval(async () => {
      if (!state.currentUser) {
        return;
      }

      const inactiveFor = Date.now() - state.lastActivityMs;
      if (inactiveFor > INACTIVITY_TIMEOUT_MS) {
        await authService.lockSession("inactivity_timeout");
        state.currentUser = null;
        stopLockMonitor();
        notify();
      }
    }, LOCK_CHECK_INTERVAL_MS);
  }

  function setSignedInState(user, session) {
    state.currentUser = user;
    state.lastActivityMs = session?.lastActivityAt
      ? Date.parse(session.lastActivityAt)
      : Date.now();
    state.lastSyncedMs = Date.now();
    startLockMonitor();
    notify();
  }

  function setSignedOutState() {
    state.currentUser = null;
    state.lastActivityMs = 0;
    state.lastSyncedMs = 0;
    stopLockMonitor();
    notify();
  }

  return {
    get currentUser() {
      return state.currentUser;
    },

    subscribe(listener) {
      state.subscribers.add(listener);
      return () => {
        state.subscribers.delete(listener);
      };
    },

    async restoreSession() {
      const restored = await authService.restoreSession(INACTIVITY_TIMEOUT_MS);
      if (!restored) {
        setSignedOutState();
        return null;
      }

      setSignedInState(restored.user, restored.session);
      return state.currentUser;
    },

    async signIn(credentials) {
      const signedIn = await authService.signIn(credentials);
      if (!signedIn) {
        setSignedOutState();
        return null;
      }

      setSignedInState(signedIn.user, signedIn.session);
      return state.currentUser;
    },

    async signOut() {
      await authService.signOut();
      setSignedOutState();
    },

    async recordActivity() {
      if (!state.currentUser) {
        return;
      }

      state.lastActivityMs = Date.now();
      const dueForSync =
        state.lastActivityMs - state.lastSyncedMs >= ACTIVITY_SYNC_THROTTLE_MS;
      if (!dueForSync) {
        return;
      }

      state.lastSyncedMs = state.lastActivityMs;
      await authService.touchSession();
    },

    can(permission) {
      return hasPermission(state.currentUser, permission);
    },

    canAccess(resourceAccess) {
      return canAccessResource(state.currentUser, resourceAccess);
    },
  };
}

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getPreferences, savePreferences } from "./preferences";
import { createAuthController } from "../auth/authController";
import { createBootstrapContext } from "./bootstrap";

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [, setAuthVersion] = useState(0);
  const [preferences, setPreferences] = useState(() => getPreferences());
  const [bootstrap] = useState(() => createBootstrapContext());
  const [auth] = useState(() => createAuthController(bootstrap.services));

  useEffect(() => {
    return auth.subscribe(() => {
      setAuthVersion((value) => value + 1);
    });
  }, [auth]);

  useEffect(() => {
    const events = ["pointerdown", "keydown", "touchstart", "scroll"];
    const handleActivity = () => {
      auth.recordActivity().catch(() => {});
    };

    for (const eventName of events) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }

    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, handleActivity);
      }
    };
  }, [auth]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      await bootstrap.init();
      await auth.restoreSession();

      if (active) {
        setReady(true);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [bootstrap, auth]);

  const value = useMemo(
    () => ({
      ready,
      services: bootstrap.services,
      plugins: bootstrap.plugins,
      modules: bootstrap.modules,
      auth,
      preferences,
      setTheme(theme) {
        const next = { ...preferences, theme };
        setPreferences(next);
        savePreferences(next);
      },
    }),
    [ready, bootstrap, auth, preferences],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }

  return context;
}

import { describe, expect, it, vi, beforeEach } from "vitest";

// Polyfill localStorage before importing the module
const store = {};
globalThis.localStorage = {
  getItem: vi.fn((key) => (key in store ? store[key] : null)),
  setItem: vi.fn((key, value) => {
    store[key] = String(value);
  }),
  removeItem: vi.fn((key) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(store)) delete store[key];
  }),
};

import { getPreferences, savePreferences } from "../src/app/preferences";

const PREFERENCES_KEY = "cfso_console_ui_preferences";

describe("preferences.js", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    vi.clearAllMocks();
  });

  describe("getPreferences", () => {
    it("returns default preferences when nothing stored", () => {
      const prefs = getPreferences();
      expect(prefs).toEqual({ theme: "light" });
    });

    it("returns stored preferences merged with defaults", () => {
      store[PREFERENCES_KEY] = JSON.stringify({ theme: "dark" });
      const prefs = getPreferences();
      expect(prefs.theme).toBe("dark");
    });

    it("preserves default keys not in stored data", () => {
      store[PREFERENCES_KEY] = JSON.stringify({});
      const prefs = getPreferences();
      expect(prefs.theme).toBe("light");
    });

    it("returns defaults for invalid JSON", () => {
      store[PREFERENCES_KEY] = "not json{{{";
      const prefs = getPreferences();
      expect(prefs).toEqual({ theme: "light" });
    });

    it("returns defaults for null stored value", () => {
      const prefs = getPreferences();
      expect(prefs).toEqual({ theme: "light" });
    });
  });

  describe("savePreferences", () => {
    it("saves preferences to localStorage", () => {
      savePreferences({ theme: "dark" });
      expect(localStorage.setItem).toHaveBeenCalledWith(
        PREFERENCES_KEY,
        JSON.stringify({ theme: "dark" }),
      );
    });

    it("round-trips through save and get", () => {
      savePreferences({ theme: "dark" });
      const loaded = getPreferences();
      expect(loaded.theme).toBe("dark");
    });
  });
});

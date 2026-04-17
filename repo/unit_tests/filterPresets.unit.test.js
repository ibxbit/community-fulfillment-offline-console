import { describe, expect, it, vi, beforeEach } from "vitest";

// Must polyfill localStorage before importing the module
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
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  }),
};

import {
  loadFilterPresets,
  saveFilterPresets,
} from "../src/modules/fulfillment/filterPresets";

const PRESETS_KEY = "cfso_fulfillment_filter_presets";

describe("filterPresets", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    vi.clearAllMocks();
  });

  describe("loadFilterPresets", () => {
    it("returns empty array when nothing is stored", () => {
      const result = loadFilterPresets();
      expect(result).toEqual([]);
    });

    it("returns empty array when stored value is null", () => {
      store[PRESETS_KEY] = null;
      const result = loadFilterPresets();
      expect(result).toEqual([]);
    });

    it("returns parsed array from localStorage", () => {
      const presets = [
        { name: "Test", filters: { itemSku: "ABC" } },
        { name: "Another", filters: { lot: "X" } },
      ];
      store[PRESETS_KEY] = JSON.stringify(presets);

      const result = loadFilterPresets();
      expect(result).toEqual(presets);
      expect(result.length).toBe(2);
    });

    it("returns empty array when stored value is not an array", () => {
      store[PRESETS_KEY] = JSON.stringify({ notAnArray: true });
      const result = loadFilterPresets();
      expect(result).toEqual([]);
    });

    it("returns empty array when stored value is invalid JSON", () => {
      store[PRESETS_KEY] = "not valid json {{{";
      const result = loadFilterPresets();
      expect(result).toEqual([]);
    });
  });

  describe("saveFilterPresets", () => {
    it("saves presets to localStorage", () => {
      const presets = [{ name: "MyPreset", filters: { itemSku: "SKU-1" } }];
      saveFilterPresets(presets);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        PRESETS_KEY,
        JSON.stringify(presets),
      );
    });

    it("saves empty array", () => {
      saveFilterPresets([]);
      expect(localStorage.setItem).toHaveBeenCalledWith(PRESETS_KEY, "[]");
    });

    it("round-trips through save and load", () => {
      const presets = [
        { name: "Preset A", filters: { lot: "LOT-1", requester: "user1" } },
        { name: "Preset B", filters: { documentStatus: "delivered" } },
      ];
      saveFilterPresets(presets);

      const loaded = loadFilterPresets();
      expect(loaded).toEqual(presets);
    });
  });
});

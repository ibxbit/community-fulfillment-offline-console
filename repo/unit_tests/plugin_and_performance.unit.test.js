import { beforeEach, describe, expect, it } from "vitest";
import { createPluginHost } from "../src/plugins/pluginHost";
import { clearAllCollections, createTestContext } from "./testHelpers";

describe("Plugin execution and large dataset behavior", () => {
  let services;
  let plugins;

  beforeEach(async () => {
    ({ services, plugins } = await createTestContext());
    await clearAllCollections(services);
  });

  it("executes discovered plugin with unified interface", async () => {
    const list = plugins.list();
    expect(list.length).toBeGreaterThan(0);

    const result = await plugins.runPlugin(list[0].id, {
      source: { name: " sample " },
      target: null,
    });

    expect(result.ok).toBe(true);
  });

  it("handles paginated query over large local dataset", async () => {
    const rows = Array.from({ length: 1500 }).map((_, index) => ({
      sku: `SKU-${index % 10}`,
      requester: `user_${index % 20}`,
      date: new Date(2026, 0, (index % 28) + 1).toISOString(),
      status: index % 2 === 0 ? "open" : "closed",
    }));

    await services.db.collections.inventory.insertMany(rows);

    const result = await services.db.collections.inventory.find(
      { sku: "SKU-1" },
      { page: 2, pageSize: 25, sort: { date: "desc" } },
    );

    expect(result.length).toBeLessThanOrEqual(25);
    expect(result.length).toBeGreaterThan(0);
  });

  it("ignores disabled and malformed manifest plugin entries", async () => {
    const host = createPluginHost({
      manifest: {
        plugins: [
          {
            id: "good-plugin",
            type: "parsers",
            module: "parsers/jsonParser",
            enabled: true,
          },
          {
            id: "disabled-plugin",
            type: "parsers",
            module: "parsers/jsonParser",
            enabled: false,
          },
          {
            id: "bad-type",
            type: "unknown",
            module: "parsers/jsonParser",
            enabled: true,
          },
        ],
      },
    });

    const discovered = await host.discover();
    expect(discovered).toHaveLength(1);
    expect(discovered[0].id).toBe("good-plugin");
  });

  it("records discovery/load failures without crashing host", async () => {
    const host = createPluginHost({
      manifest: {
        plugins: [
          {
            id: "missing-loader",
            type: "adapters",
            module: "adapters/does-not-exist",
            enabled: true,
          },
        ],
      },
    });

    await host.initialize({ services, modules: [] });

    const errors = host.listErrors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].pluginId).toBe("missing-loader");
    expect(errors[0].stage).toBe("load");
  });

  it("captures plugin run-time errors and returns safe failure", async () => {
    plugins.register({
      id: "failing-plugin",
      type: "cleaners",
      async read(input) {
        return input;
      },
      async normalize(input) {
        return input;
      },
      async write() {
        throw new Error("write failed");
      },
    });

    const result = await plugins.runPlugin("failing-plugin", {
      source: { value: 1 },
      target: null,
    });

    expect(result.ok).toBe(false);
    expect(result.error.stage).toBe("run");

    const errors = plugins.listErrors();
    expect(errors.some((entry) => entry.pluginId === "failing-plugin")).toBe(
      true,
    );
  });
});

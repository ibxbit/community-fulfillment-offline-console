import { describe, expect, it } from "vitest";
import { createBootstrapContext } from "../src/app/bootstrap";

describe("bootstrap.js — createBootstrapContext", () => {
  it("returns services, plugins, modules, and init function", () => {
    const ctx = createBootstrapContext();

    expect(ctx.services).toBeTruthy();
    expect(ctx.plugins).toBeTruthy();
    expect(Array.isArray(ctx.modules)).toBe(true);
    expect(typeof ctx.init).toBe("function");
  });

  it("init() resolves without error", async () => {
    const ctx = createBootstrapContext();
    await expect(ctx.init()).resolves.toBeUndefined();
  });

  it("services.router is available after init", async () => {
    const ctx = createBootstrapContext();
    await ctx.init();

    expect(ctx.services.router).toBeTruthy();
    expect(typeof ctx.services.router.call).toBe("function");
  });

  it("services.db is initialized after init", async () => {
    const ctx = createBootstrapContext();
    await ctx.init();

    expect(ctx.services.db).toBeTruthy();
    expect(ctx.services.db.collections).toBeTruthy();
  });

  it("plugins system is initialized after init", async () => {
    const ctx = createBootstrapContext();
    await ctx.init();

    expect(typeof ctx.plugins.list).toBe("function");
    expect(typeof ctx.plugins.runPlugin).toBe("function");
  });

  it("can call a route after full bootstrap", async () => {
    const ctx = createBootstrapContext();
    await ctx.init();

    // verify-chain works with no data — it should be valid (empty chain)
    const result = await ctx.services.router.call("GET /audit/verify-chain", {});
    // Without auth this returns 401 — proving the router+auth is wired
    expect(result.status).toBe(401);
  });
});

import { loadPluginModule } from "./pluginModuleRegistry";

const ALLOWED_PLUGIN_TYPES = new Set([
  "adapters",
  "parsers",
  "cleaners",
  "storage_backends",
]);

function isValidManifestEntry(entry) {
  return Boolean(
    entry &&
      entry.id &&
      entry.module &&
      ALLOWED_PLUGIN_TYPES.has(entry.type) &&
      entry.enabled !== false,
  );
}

function assertUnifiedInterface(plugin, pluginId) {
  const requiredMethods = ["read", "normalize", "write"];

  for (const method of requiredMethods) {
    if (typeof plugin?.[method] !== "function") {
      throw new Error(`Plugin '${pluginId}' must implement ${method}(...)`);
    }
  }
}

function isolateContext(context) {
  // Plugins only receive the minimum runtime surface required for extension.
  // This keeps plugin setup deterministic and avoids mutating host internals.
  return {
    services: context.services,
    modules: context.modules,
  };
}

function deepClone(value) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}

export function createPluginHost({ manifest }) {
  const plugins = new Map();
  const discovery = [];
  const errors = [];

  return {
    async discover() {
      // Discovery is manifest-driven and intentionally defensive: unsupported,
      // disabled, or malformed entries never reach the loading phase.
      const discovered = Array.isArray(manifest?.plugins)
        ? manifest.plugins.filter((entry) => isValidManifestEntry(entry))
        : [];

      discovery.splice(0, discovery.length, ...discovered);
      return [...discovery];
    },

    async loadDiscovered() {
      const entries = discovery.length > 0 ? discovery : await this.discover();

      for (const entry of entries) {
        try {
          const module = await loadPluginModule(entry.module);
          const implementation = module.default ?? module;

          assertUnifiedInterface(implementation, entry.id);

          plugins.set(entry.id, {
            id: entry.id,
            type: entry.type,
            module: entry.module,
            impl: implementation,
          });
        } catch (error) {
          // Failed plugin loads are recorded but do not block other plugins.
          errors.push({
            pluginId: entry.id,
            stage: "load",
            message: String(error.message ?? error),
          });
        }
      }

      return this.list();
    },

    register(plugin) {
      if (!plugin?.id || !plugin?.type) {
        throw new Error("Plugin must include id and type");
      }

      if (!ALLOWED_PLUGIN_TYPES.has(plugin.type)) {
        throw new Error(`Unsupported plugin type: ${plugin.type}`);
      }

      assertUnifiedInterface(plugin, plugin.id);

      plugins.set(plugin.id, {
        id: plugin.id,
        type: plugin.type,
        module: plugin.module ?? "manual",
        impl: plugin,
      });
      return plugin;
    },

    list() {
      return Array.from(plugins.values()).map(({ impl, ...meta }) => meta);
    },

    listErrors() {
      return [...errors];
    },

    async initialize(context) {
      await this.discover();
      await this.loadDiscovered();

      const isolated = isolateContext(context);
      for (const plugin of plugins.values()) {
        if (typeof plugin.impl.setup === "function") {
          try {
            await plugin.impl.setup(isolated);
          } catch (error) {
            // setup failures are isolated per plugin; host remains available.
            errors.push({
              pluginId: plugin.id,
              stage: "setup",
              message: String(error.message ?? error),
            });
          }
        }
      }
    },

    async runPlugin(pluginId, { source, target }) {
      const plugin = plugins.get(pluginId);
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      try {
        const readData = await plugin.impl.read(deepClone(source));
        const normalized = await plugin.impl.normalize(deepClone(readData));
        const written = await plugin.impl.write(target, deepClone(normalized));

        return {
          ok: true,
          pluginId,
          data: written,
        };
      } catch (error) {
        const entry = {
          pluginId,
          stage: "run",
          message: String(error.message ?? error),
        };
        errors.push(entry);

        return {
          ok: false,
          pluginId,
          error: entry,
        };
      }
    },
  };
}

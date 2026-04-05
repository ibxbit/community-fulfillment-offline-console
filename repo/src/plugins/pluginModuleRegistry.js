export const PLUGIN_MODULE_LOADERS = {
  "adapters/localJsonAdapter": () => import("./adapters/localJsonAdapter"),
  "parsers/jsonParser": () => import("./parsers/jsonParser"),
  "cleaners/basicCleaner": () => import("./cleaners/basicCleaner"),
  "storage/indexedDbStorage": () => import("./storage/indexedDbStorage"),
};

export async function loadPluginModule(modulePath) {
  const loader = PLUGIN_MODULE_LOADERS[modulePath];
  if (!loader) {
    throw new Error(`Plugin module loader not found: ${modulePath}`);
  }

  return loader();
}

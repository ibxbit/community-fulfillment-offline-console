import { createAppServices } from "../services";
import { createPluginSystem } from "../plugins";
import { moduleRegistry } from "../modules";

export function createBootstrapContext() {
  const plugins = createPluginSystem();
  const services = createAppServices({ plugins });

  return {
    services,
    plugins,
    modules: moduleRegistry,
    async init() {
      await services.init();
      await plugins.initialize({ services, modules: moduleRegistry });
    },
  };
}

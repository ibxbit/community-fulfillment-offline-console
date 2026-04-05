import { createAppServices } from "../src/services";
import { createPluginSystem } from "../src/plugins";

export async function createTestContext() {
  const plugins = createPluginSystem();
  const services = createAppServices({ plugins });
  await services.init();
  await plugins.initialize({ services, modules: [] });

  return { services, plugins };
}

export async function clearAllCollections(services) {
  const collections = Object.values(services.db.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

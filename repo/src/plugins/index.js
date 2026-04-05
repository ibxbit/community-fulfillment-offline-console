import { createPluginHost } from "./pluginHost";
import manifest from "./manifest.json";

export function createPluginSystem() {
  return createPluginHost({ manifest });
}

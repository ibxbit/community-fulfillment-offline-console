export const moduleRegistry = [];

export function registerModule(moduleDef) {
  moduleRegistry.push(moduleDef);
  return moduleDef;
}

import type { ModuleCatalog, ModuleDefinition } from './ModuleDefinition.ts'

export function moduleForTests(
  id: string,
  overrides: Partial<ModuleDefinition> = {},
): ModuleDefinition {
  return {
    id,
    label: id,
    description: id,
    section: 'Tools',
    selectedByDefault: false,
    requires: [],
    packages: [],
    downloads: [],
    environment: {},
    path: [],
    mutuallyExclusiveWith: [],
    container: { privileged: false, volumes: [] },
    portPresets: [],
    legacySettings: [],
    hasConfig: false,
    hasSetup: false,
    ...overrides,
  }
}

export function catalogForTests(modules: ModuleDefinition[]): ModuleCatalog {
  return { modules, byId: new Map(modules.map((module) => [module.id, module])) }
}

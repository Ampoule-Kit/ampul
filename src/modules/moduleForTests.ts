import {
  type ModuleCatalog,
  type ModuleDefinition,
  type ModuleVersionDefinition,
  singleVersionId,
} from './ModuleDefinition.ts'

type VersionFields = {
  [Field in keyof Omit<ModuleVersionDefinition, 'id' | 'label'>]?:
    | ModuleVersionDefinition[Field]
    | undefined
}

export function versionForTests(
  id: string,
  fields: VersionFields & { label?: string | undefined } = {},
): ModuleVersionDefinition {
  return {
    id,
    label: fields.label ?? id,
    version: fields.version,
    latestVersion: fields.latestVersion,
    requires: fields.requires ?? [],
    packages: fields.packages ?? [],
    downloads: fields.downloads ?? [],
    environment: fields.environment ?? {},
    path: fields.path ?? [],
  }
}

export type ModuleOverridesForTests = Partial<ModuleDefinition> & VersionFields

export function moduleForTests(
  id: string,
  overrides: ModuleOverridesForTests = {},
): ModuleDefinition {
  const {
    version,
    latestVersion,
    requires,
    packages,
    downloads,
    environment,
    path,
    ...moduleOverrides
  } = overrides
  const singleVersion = versionForTests(singleVersionId, {
    version,
    latestVersion,
    requires,
    packages,
    downloads,
    environment,
    path,
  })
  return {
    id,
    label: id,
    description: id,
    section: 'Tools',
    selectedByDefault: false,
    mutuallyExclusiveWith: [],
    container: { privileged: false, volumes: [] },
    hasSetup: false,
    hasVersionChoice: overrides.versions !== undefined,
    multipleVersions: false,
    versions: [singleVersion],
    ...moduleOverrides,
  }
}

export function catalogForTests(modules: ModuleDefinition[]): ModuleCatalog {
  return { modules, byId: new Map(modules.map((module) => [module.id, module])) }
}

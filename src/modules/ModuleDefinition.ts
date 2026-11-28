import type {
  LatestVersionSource,
  ModuleContainerSettings,
  ModuleDownload,
} from './moduleSchema.ts'

export const singleVersionId = 'default'

export interface ModuleVersionDefinition {
  id: string
  label: string
  version: string | undefined
  latestVersion: LatestVersionSource | undefined
  requires: string[]
  packages: string[]
  downloads: ModuleDownload[]
  environment: Record<string, string>
  path: string[]
}

export interface ModuleDefinition {
  id: string
  label: string
  description: string
  section: string
  selectedByDefault: boolean
  mutuallyExclusiveWith: string[]
  container: ModuleContainerSettings
  hasSetup: boolean
  hasVersionChoice: boolean
  multipleVersions: boolean
  versions: ModuleVersionDefinition[]
}

export interface ModuleInstall extends Omit<ModuleDefinition, 'versions'>, ModuleVersionFields {
  versionId: string
  versionLabel: string
}

type ModuleVersionFields = Omit<ModuleVersionDefinition, 'id' | 'label'>

export interface ModuleCatalog {
  modules: ModuleDefinition[]
  byId: ReadonlyMap<string, ModuleDefinition>
}

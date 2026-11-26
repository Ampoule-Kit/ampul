export interface ModuleDownload {
  name?: string
  version?: string
}

export interface ModuleDefinition {
  id: string
  label: string
  description: string
  section: string
  version?: string
  selectedByDefault: boolean
  requires: string[]
  group?: string
  packages: string[]
  downloads: ModuleDownload[]
  environment: Record<string, string>
  path: string[]
  hasConfig: boolean
  hasSetup: boolean
}

export interface ModuleCatalog {
  modules: ModuleDefinition[]
  byId: Map<string, ModuleDefinition>
}

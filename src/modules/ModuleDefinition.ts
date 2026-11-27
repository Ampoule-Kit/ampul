import type { ModuleFile } from './moduleSchema.ts'

export interface ModuleDefinition extends Omit<ModuleFile, '$schema' | 'check'> {
  id: string
  section: string
  hasSetup: boolean
}

export interface ModuleCatalog {
  modules: ModuleDefinition[]
  byId: ReadonlyMap<string, ModuleDefinition>
}

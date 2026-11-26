import { moduleCatalog } from '../modules/moduleCatalog.js'
import { defaultModuleIds, withRequiredModules } from '../modules/moduleSelection.js'
import type { ProjectSettings } from './ProjectSettings.js'

export interface SettingsBeforeModules extends Omit<ProjectSettings, 'modules'> {
  modules?: undefined
  dotnetSdks?: string[]
  optionalDependencies?: Record<string, string>
}

export type StoredProjectSettings = ProjectSettings | SettingsBeforeModules

const modulesForOptionalDependencies: Record<string, (value: string) => string> = {
  JAVA: () => 'java',
  PYTHON: () => 'python',
  CONTAINER_ENGINE: () => 'container-engine',
  GODOT: (variant) => (variant === 'dotnet' ? 'godot-dotnet' : 'godot'),
}

export function isFromBeforeModules(
  settings: StoredProjectSettings,
): settings is SettingsBeforeModules {
  return settings.modules === undefined
}

export function migrateToModules(settings: SettingsBeforeModules): ProjectSettings {
  const catalog = moduleCatalog()
  const { dotnetSdks = [], optionalDependencies = {}, ...rest } = settings
  const optionalModules = Object.entries(optionalDependencies).flatMap(([setting, value]) => {
    const moduleFor = modulesForOptionalDependencies[setting]
    return moduleFor && value ? [moduleFor(value)] : []
  })
  const selected = [
    ...defaultModuleIds(catalog),
    ...dotnetSdks.map((channel) => `dotnet-${channel}`),
    ...optionalModules,
  ]
  return { ...rest, modules: withRequiredModules(selected, catalog) }
}

import { moduleCatalog } from '../modules/moduleCatalog.ts'
import { defaultModuleIds, withRequiredModules } from '../modules/moduleSelection.ts'
import type { ProjectSettings, SettingsBeforeModules } from './ProjectSettings.ts'

const moduleForOptionalDependency: Record<string, (chosenValue: string) => string> = {
  JAVA: () => 'java',
  PYTHON: () => 'python',
  CONTAINER_ENGINE: () => 'container-engine',
  GODOT: (variant) => (variant === 'dotnet' ? 'godot-dotnet' : 'godot'),
}

function modulesForOptionalDependencies(optionalDependencies: Record<string, string>): string[] {
  return Object.entries(optionalDependencies).flatMap(([setting, chosenValue]) => {
    const moduleFor = moduleForOptionalDependency[setting]
    return moduleFor && chosenValue ? [moduleFor(chosenValue)] : []
  })
}

export function migrateToModules(settings: SettingsBeforeModules): ProjectSettings {
  const catalog = moduleCatalog()
  const { dotnetSdks, optionalDependencies, ...settingsThatStayTheSame } = settings
  const selectedModules = [
    ...defaultModuleIds(catalog),
    ...dotnetSdks.map((channel) => `dotnet-${channel}`),
    ...modulesForOptionalDependencies(optionalDependencies),
  ]
  return { ...settingsThatStayTheSame, modules: withRequiredModules(selectedModules, catalog) }
}

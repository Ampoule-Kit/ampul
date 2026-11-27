import type { ModuleCatalog } from '../modules/ModuleDefinition.ts'
import { moduleCatalog } from '../modules/moduleCatalog.ts'
import { defaultModuleIds, withRequiredModules } from '../modules/moduleSelection.ts'
import type { ProjectSettings, SettingsBeforeModules } from './ProjectSettings.ts'

interface LegacyValue {
  setting: string
  value: string
}

function legacyValues(settings: SettingsBeforeModules): LegacyValue[] {
  return Object.entries(settings.legacySettings).flatMap(([setting, values]) =>
    values.map((value) => ({ setting, value })),
  )
}

export function modulesForLegacyValue(legacy: LegacyValue, catalog: ModuleCatalog): string[] {
  const matching = (exact: boolean) =>
    catalog.modules
      .filter((module) =>
        module.legacySettings.some(
          (rule) =>
            rule.setting === legacy.setting &&
            (exact ? rule.value === legacy.value : rule.value === undefined),
        ),
      )
      .map((module) => module.id)
  const exactMatches = matching(true)
  return exactMatches.length > 0 ? exactMatches : matching(false)
}

export function migrateToModules(
  settings: SettingsBeforeModules,
  catalog: ModuleCatalog = moduleCatalog(),
): ProjectSettings {
  const { legacySettings: _legacySettings, ...unchanged } = settings
  const selectedModules = [
    ...defaultModuleIds(catalog),
    ...legacyValues(settings).flatMap((legacy) => modulesForLegacyValue(legacy, catalog)),
  ]
  return { ...unchanged, modules: withRequiredModules(selectedModules, catalog) }
}

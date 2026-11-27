import type { ModuleCatalog, ModuleDefinition } from '../modules/ModuleDefinition.ts'
import { moduleCatalog } from '../modules/moduleCatalog.ts'
import { selectedModules } from '../modules/moduleSelection.ts'
import { combinePorts, type PortRange, portsInRange } from './ports.ts'

export interface PortPreset {
  id: string
  label: string
  range: PortRange
  section: string
  description: string
}

export function portPresetsOf(modules: ModuleDefinition[]): PortPreset[] {
  const presets = new Map<string, PortPreset>()
  for (const module of modules) {
    for (const preset of module.portPresets) {
      if (presets.has(preset.id)) continue
      presets.set(preset.id, {
        id: preset.id,
        label: preset.label,
        range: { first: preset.port, last: preset.lastPort ?? preset.port },
        section: preset.section,
        description: preset.description,
      })
    }
  }
  const sections = [...new Set([...presets.values()].map((preset) => preset.section))]
  return sections.flatMap((section) =>
    [...presets.values()].filter((preset) => preset.section === section),
  )
}

export function allPortPresets(catalog: ModuleCatalog = moduleCatalog()): PortPreset[] {
  return portPresetsOf(catalog.modules)
}

export function offeredPortPresets(
  moduleIds: string[],
  catalog: ModuleCatalog = moduleCatalog(),
): PortPreset[] {
  return portPresetsOf(selectedModules(moduleIds, catalog))
}

export function presetRanges(
  presetIds: string[],
  presets: PortPreset[] = allPortPresets(),
): PortRange[] {
  return presets.filter((preset) => presetIds.includes(preset.id)).map((preset) => preset.range)
}

export function presetsCoveredBy(
  ports: number[],
  presets: PortPreset[],
): { presetIds: string[]; otherPorts: number[] } {
  const presetIds = presets
    .filter((preset) => portsInRange(preset.range).every((port) => ports.includes(port)))
    .map((preset) => preset.id)
  const coveredPorts = combinePorts(presetRanges(presetIds, presets))
  return { presetIds, otherPorts: ports.filter((port) => !coveredPorts.includes(port)) }
}

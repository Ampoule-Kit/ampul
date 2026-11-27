import { joinInProse } from '../text/prose.ts'
import type { ModuleCatalog, ModuleDefinition } from './ModuleDefinition.ts'
import type { ModuleVolume } from './moduleSchema.ts'

export function defaultModuleIds(catalog: ModuleCatalog): string[] {
  return catalog.modules.filter((module) => module.selectedByDefault).map((module) => module.id)
}

export function withRequiredModules(ids: string[], catalog: ModuleCatalog): string[] {
  const selectedIds = new Set<string>()
  const select = (id: string) => {
    const module = catalog.byId.get(id)
    if (!module || selectedIds.has(id)) return
    selectedIds.add(id)
    module.requires.forEach(select)
  }
  ids.forEach(select)
  return catalog.modules.filter((module) => selectedIds.has(module.id)).map((module) => module.id)
}

export function selectedModules(ids: string[], catalog: ModuleCatalog): ModuleDefinition[] {
  const selectedIds = new Set(withRequiredModules(ids, catalog))
  return catalog.modules.filter((module) => selectedIds.has(module.id))
}

export function requiringModuleLabels(
  ids: string[],
  catalog: ModuleCatalog,
): Map<string, string[]> {
  const labelsByRequiredId = new Map<string, string[]>()
  for (const module of selectedModules(ids, catalog)) {
    for (const requiredId of module.requires) {
      labelsByRequiredId.set(requiredId, [
        ...(labelsByRequiredId.get(requiredId) ?? []),
        module.label,
      ])
    }
  }
  return labelsByRequiredId
}

export function installationOrder(ids: string[], catalog: ModuleCatalog): ModuleDefinition[] {
  const ordered: ModuleDefinition[] = []
  const placeAfterRequirements = (module: ModuleDefinition) => {
    if (ordered.includes(module)) return
    for (const requiredId of module.requires) {
      const requiredModule = catalog.byId.get(requiredId)
      if (requiredModule) placeAfterRequirements(requiredModule)
    }
    ordered.push(module)
  }
  selectedModules(ids, catalog).forEach(placeAfterRequirements)
  return ordered
}

export function moduleLabels(ids: string[], catalog: ModuleCatalog): string[] {
  return selectedModules(ids, catalog).map((module) => module.label)
}

export function moduleVersionText(module: ModuleDefinition): string {
  if (module.version) return module.version
  const namedDownloadVersions = module.downloads.flatMap((download) =>
    download.name && download.version ? [`${download.name} ${download.version}`] : [],
  )
  if (namedDownloadVersions.length > 0) return namedDownloadVersions.join(', ')
  return module.packages.length > 0 ? 'from Ubuntu' : ''
}

export function describeModuleSelection(ids: string[], catalog: ModuleCatalog): string {
  const chosenModules = selectedModules(ids, catalog)
  const defaultModules = catalog.modules.filter((module) => module.selectedByDefault)
  const addedLabels = chosenModules
    .filter((module) => !module.selectedByDefault)
    .map((module) => module.label)
  const leftOutLabels = defaultModules
    .filter((module) => !chosenModules.includes(module))
    .map((module) => module.label)

  if (leftOutLabels.length === defaultModules.length) {
    return addedLabels.length > 0 ? `Only ${joinInProse(addedLabels)}` : 'No tools'
  }
  const base =
    leftOutLabels.length === 0
      ? 'The defaults'
      : `The defaults without ${joinInProse(leftOutLabels)}`
  return addedLabels.length > 0 ? `${base}, plus ${joinInProse(addedLabels)}` : base
}

export interface SelectionConflict {
  exclusiveGroup: string
  labels: string[]
}

export function selectionConflicts(ids: string[], catalog: ModuleCatalog): SelectionConflict[] {
  const labelsByGroup = new Map<string, string[]>()
  for (const module of selectedModules(ids, catalog)) {
    if (module.exclusiveGroup === undefined) continue
    labelsByGroup.set(module.exclusiveGroup, [
      ...(labelsByGroup.get(module.exclusiveGroup) ?? []),
      module.label,
    ])
  }
  return [...labelsByGroup]
    .filter(([, labels]) => labels.length > 1)
    .map(([exclusiveGroup, labels]) => ({ exclusiveGroup, labels }))
}

export function describeConflict(conflict: SelectionConflict): string {
  return `${joinInProse(conflict.labels)} can’t be selected together`
}

export function privilegedModuleLabels(ids: string[], catalog: ModuleCatalog): string[] {
  return selectedModules(ids, catalog)
    .filter((module) => module.container.privileged)
    .map((module) => module.label)
}

export function moduleVolumes(ids: string[], catalog: ModuleCatalog): ModuleVolume[] {
  return selectedModules(ids, catalog).flatMap((module) => module.container.volumes)
}

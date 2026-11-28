import { joinInProse } from '../text/prose.ts'
import type {
  ModuleCatalog,
  ModuleDefinition,
  ModuleInstall,
  ModuleVersionDefinition,
} from './ModuleDefinition.ts'
import type { ModuleVolume } from './moduleSchema.ts'
import { parseRequirement } from './moduleVersions.ts'

export interface ModuleSelection {
  modules: readonly string[]
  moduleVersions: Readonly<Record<string, readonly string[]>>
}

export function selectionOf(
  modules: readonly string[],
  moduleVersions: Readonly<Record<string, readonly string[]>> = {},
): ModuleSelection {
  return { modules, moduleVersions }
}

export function defaultModuleIds(catalog: ModuleCatalog): string[] {
  return catalog.modules.filter((module) => module.selectedByDefault).map((module) => module.id)
}

export function newestVersion(module: ModuleDefinition): ModuleVersionDefinition {
  const [latest] = module.versions
  if (!latest) throw new Error(`The module ${module.id} has no versions`)
  return latest
}

export function chosenVersionIds(
  module: ModuleDefinition,
  moduleVersions: ModuleSelection['moduleVersions'],
): string[] {
  const asked = moduleVersions[module.id] ?? []
  const known = module.versions.filter((version) => asked.includes(version.id))
  if (known.length === 0) return [newestVersion(module).id]
  return (module.multipleVersions ? known : known.slice(0, 1)).map((version) => version.id)
}

function hasPickedVersions(
  module: ModuleDefinition,
  moduleVersions: ModuleSelection['moduleVersions'],
): boolean {
  const asked = moduleVersions[module.id] ?? []
  return module.versions.some((version) => asked.includes(version.id))
}

function versionKey(moduleId: string, versionId: string): string {
  return `${moduleId}@${versionId}`
}

interface ResolvedSelection {
  versionsById: Map<string, Set<string>>
  requiredBy: Map<string, string[]>
  requiredVersionBy: Map<string, string[]>
}

function addLabel(labels: Map<string, string[]>, key: string, label: string): void {
  const existing = labels.get(key) ?? []
  if (!existing.includes(label)) labels.set(key, [...existing, label])
}

function resolveSelection(selection: ModuleSelection, catalog: ModuleCatalog): ResolvedSelection {
  const versionsById = new Map<string, Set<string>>()
  const requiredBy = new Map<string, string[]>()
  const requiredVersionBy = new Map<string, string[]>()
  const pending: [ModuleDefinition, string][] = []

  const addVersion = (module: ModuleDefinition, versionId: string) => {
    const versions = versionsById.get(module.id) ?? new Set<string>()
    versionsById.set(module.id, versions)
    if (versions.has(versionId)) return
    versions.add(versionId)
    pending.push([module, versionId])
  }
  // A module that is only there for a version another module requires gets just that
  // version, unless versions of it were picked.
  const addModule = (module: ModuleDefinition, requiredVersionId?: string) => {
    const onlyTheRequiredVersion =
      requiredVersionId !== undefined && !hasPickedVersions(module, selection.moduleVersions)
    if (!versionsById.has(module.id) && !onlyTheRequiredVersion) {
      for (const versionId of chosenVersionIds(module, selection.moduleVersions)) {
        addVersion(module, versionId)
      }
    }
    if (requiredVersionId !== undefined) addVersion(module, requiredVersionId)
  }

  for (const id of selection.modules) {
    const module = catalog.byId.get(id)
    if (module) addModule(module)
  }
  for (let next = pending.shift(); next; next = pending.shift()) {
    const [module, versionId] = next
    const version = module.versions.find((candidate) => candidate.id === versionId)
    for (const requirement of version?.requires ?? []) {
      const { moduleId, versionId: requiredVersionId } = parseRequirement(requirement)
      const required = catalog.byId.get(moduleId)
      if (!required) continue
      addLabel(requiredBy, moduleId, module.label)
      if (requiredVersionId !== undefined) {
        addLabel(requiredVersionBy, versionKey(moduleId, requiredVersionId), module.label)
      }
      addModule(required, requiredVersionId)
    }
  }
  return { versionsById, requiredBy, requiredVersionBy }
}

function versionsInCatalogOrder(module: ModuleDefinition, ids: Set<string> | undefined) {
  return module.versions.filter((version) => ids?.has(version.id))
}

export function selectedModules(
  selection: ModuleSelection,
  catalog: ModuleCatalog,
): ModuleDefinition[] {
  const { versionsById } = resolveSelection(selection, catalog)
  return catalog.modules.filter((module) => versionsById.has(module.id))
}

export function withRequiredModules(
  selection: ModuleSelection,
  catalog: ModuleCatalog,
): { modules: string[]; moduleVersions: Record<string, string[]> } {
  const { versionsById } = resolveSelection(selection, catalog)
  const modules = catalog.modules.filter((module) => versionsById.has(module.id))
  return {
    modules: modules.map((module) => module.id),
    moduleVersions: Object.fromEntries(
      modules
        .filter((module) => module.hasVersionChoice)
        .map((module) => [
          module.id,
          versionsInCatalogOrder(module, versionsById.get(module.id)).map((version) => version.id),
        ]),
    ),
  }
}

export function requiringModuleLabels(
  selection: ModuleSelection,
  catalog: ModuleCatalog,
): Map<string, string[]> {
  return resolveSelection(selection, catalog).requiredBy
}

export function requiringVersionLabels(
  selection: ModuleSelection,
  catalog: ModuleCatalog,
  moduleId: string,
  versionId: string,
): string[] {
  return (
    resolveSelection(selection, catalog).requiredVersionBy.get(versionKey(moduleId, versionId)) ??
    []
  )
}

function inInstallationOrder(
  modules: ModuleDefinition[],
  versionsById: Map<string, Set<string>>,
  catalog: ModuleCatalog,
): ModuleDefinition[] {
  const ordered: ModuleDefinition[] = []
  const placeAfterRequirements = (module: ModuleDefinition) => {
    if (ordered.includes(module)) return
    for (const version of versionsInCatalogOrder(module, versionsById.get(module.id))) {
      for (const requirement of version.requires) {
        const required = catalog.byId.get(parseRequirement(requirement).moduleId)
        if (required) placeAfterRequirements(required)
      }
    }
    ordered.push(module)
  }
  modules.forEach(placeAfterRequirements)
  return ordered
}

export function installationOrder(
  selection: ModuleSelection,
  catalog: ModuleCatalog,
): ModuleDefinition[] {
  const { versionsById } = resolveSelection(selection, catalog)
  const modules = catalog.modules.filter((module) => versionsById.has(module.id))
  return inInstallationOrder(modules, versionsById, catalog)
}

export function installOf(
  module: ModuleDefinition,
  version: ModuleVersionDefinition,
): ModuleInstall {
  const { versions: _versions, ...moduleFields } = module
  const { id: versionId, label: versionLabel, ...versionFields } = version
  return { ...moduleFields, ...versionFields, versionId, versionLabel }
}

export function moduleInstalls(
  selection: ModuleSelection,
  catalog: ModuleCatalog,
): ModuleInstall[] {
  const { versionsById } = resolveSelection(selection, catalog)
  const modules = catalog.modules.filter((module) => versionsById.has(module.id))
  return inInstallationOrder(modules, versionsById, catalog).flatMap((module) =>
    versionsInCatalogOrder(module, versionsById.get(module.id)).map((version) =>
      installOf(module, version),
    ),
  )
}

export function moduleLabels(selection: ModuleSelection, catalog: ModuleCatalog): string[] {
  return selectedModules(selection, catalog).map((module) => module.label)
}

const versionsListedInFull = 4

export function moduleVersionText(module: ModuleDefinition): string {
  if (!module.hasVersionChoice) return newestVersion(module).label
  if (module.versions.length > versionsListedInFull) {
    return `${module.versions.length} versions, newest ${newestVersion(module).label}`
  }
  return module.versions.map((version) => version.label).join(', ')
}

export function describeModuleSelection(
  selection: ModuleSelection,
  catalog: ModuleCatalog,
): string {
  const chosenModules = selectedModules(selection, catalog)
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

export function describeVersionChoices(selection: ModuleSelection, catalog: ModuleCatalog): string {
  const { versionsById } = resolveSelection(selection, catalog)
  const choices = catalog.modules
    .filter((module) => module.hasVersionChoice && versionsById.has(module.id))
    .map((module) => {
      const labels = versionsInCatalogOrder(module, versionsById.get(module.id)).map(
        (version) => version.label,
      )
      return `${module.label} ${joinInProse(labels)}`
    })
  return choices.join(', ')
}

export function areMutuallyExclusive(
  first: Pick<ModuleDefinition, 'id' | 'mutuallyExclusiveWith'>,
  second: Pick<ModuleDefinition, 'id' | 'mutuallyExclusiveWith'>,
): boolean {
  return (
    first.mutuallyExclusiveWith.includes(second.id) ||
    second.mutuallyExclusiveWith.includes(first.id)
  )
}

export function mutuallyExclusiveIds(module: ModuleDefinition, catalog: ModuleCatalog): string[] {
  return catalog.modules
    .filter((other) => other !== module && areMutuallyExclusive(module, other))
    .map((other) => other.id)
}

export interface SelectionConflict {
  labels: [string, string]
}

export function conflictsAmong<
  Module extends Pick<ModuleDefinition, 'id' | 'mutuallyExclusiveWith'>,
>(modules: Module[]): [Module, Module][] {
  return modules.flatMap((module, index) =>
    modules
      .slice(index + 1)
      .filter((other) => areMutuallyExclusive(module, other))
      .map((other): [Module, Module] => [module, other]),
  )
}

export function selectionConflicts(
  selection: ModuleSelection,
  catalog: ModuleCatalog,
): SelectionConflict[] {
  return conflictsAmong(selectedModules(selection, catalog)).map(([first, second]) => ({
    labels: [first.label, second.label],
  }))
}

export function describeConflict(conflict: SelectionConflict): string {
  return `${joinInProse(conflict.labels)} are mutually exclusive`
}

export function privilegedModuleLabels(
  selection: ModuleSelection,
  catalog: ModuleCatalog,
): string[] {
  return selectedModules(selection, catalog)
    .filter((module) => module.container.privileged)
    .map((module) => module.label)
}

export function moduleVolumes(selection: ModuleSelection, catalog: ModuleCatalog): ModuleVolume[] {
  return selectedModules(selection, catalog).flatMap((module) => module.container.volumes)
}

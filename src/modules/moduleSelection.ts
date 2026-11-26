import type { ModuleCatalog, ModuleDefinition } from './ModuleDefinition.js'

export function defaultModuleIds(catalog: ModuleCatalog): string[] {
  return catalog.modules.filter((module) => module.selectedByDefault).map((module) => module.id)
}

export function withRequiredModules(ids: string[], catalog: ModuleCatalog): string[] {
  const selected = new Set<string>()
  const add = (id: string) => {
    const module = catalog.byId.get(id)
    if (!module || selected.has(id)) return
    selected.add(id)
    module.requires.forEach(add)
  }
  ids.forEach(add)
  return catalog.modules.filter((module) => selected.has(module.id)).map((module) => module.id)
}

export function requiringModules(ids: string[], catalog: ModuleCatalog): Map<string, string[]> {
  const requiredBy = new Map<string, string[]>()
  for (const id of withRequiredModules(ids, catalog)) {
    const module = catalog.byId.get(id)!
    for (const required of module.requires) {
      requiredBy.set(required, [...(requiredBy.get(required) ?? []), module.label])
    }
  }
  return requiredBy
}

export function installationOrder(ids: string[], catalog: ModuleCatalog): ModuleDefinition[] {
  const ordered: ModuleDefinition[] = []
  const visit = (id: string) => {
    const module = catalog.byId.get(id)
    if (!module || ordered.includes(module)) return
    module.requires.forEach(visit)
    ordered.push(module)
  }
  withRequiredModules(ids, catalog).forEach(visit)
  return ordered
}

export function moduleLabels(ids: string[], catalog: ModuleCatalog): string[] {
  return withRequiredModules(ids, catalog).map((id) => catalog.byId.get(id)!.label)
}

export function moduleVersionText(module: ModuleDefinition): string {
  if (module.version) return module.version
  const namedVersions = module.downloads
    .filter((download) => download.name && download.version)
    .map((download) => `${download.name} ${download.version}`)
  if (namedVersions.length > 0) return namedVersions.join(', ')
  return module.packages.length > 0 ? 'from Ubuntu' : ''
}

export function joinInProse(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

export function describeModuleSelection(ids: string[], catalog: ModuleCatalog): string {
  const selected = withRequiredModules(ids, catalog)
  const defaults = defaultModuleIds(catalog)
  const labelOf = (id: string) => catalog.byId.get(id)!.label
  const added = selected.filter((id) => !defaults.includes(id)).map(labelOf)
  const left = defaults.filter((id) => !selected.includes(id)).map(labelOf)

  if (left.length === defaults.length) {
    return added.length > 0 ? `Only ${joinInProse(added)}` : 'No tools'
  }
  const base = left.length === 0 ? 'The defaults' : `The defaults without ${joinInProse(left)}`
  return added.length > 0 ? `${base}, plus ${joinInProse(added)}` : base
}

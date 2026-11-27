import { Problem } from '../problems/Problem.ts'
import type { ModuleDefinition } from './ModuleDefinition.ts'

export const modulesFolder = 'modules'
export const catalogFileName = 'catalog.json'
export const moduleFileName = 'module.json'

export function brokenCatalog(title: string, explanation: string): Problem {
  return new Problem(title, {
    explanation,
    fixes: [
      { description: `Fix it in the ${modulesFolder}/ folder of the ampul repo` },
      { description: 'Then build and install ampul again', command: 'npm run cli:install' },
    ],
  })
}

function checkEveryFolderIsListed(
  byId: ReadonlyMap<string, ModuleDefinition>,
  moduleFolders: string[],
): void {
  const unlisted = moduleFolders.filter((folder) => !byId.has(folder))
  if (unlisted.length === 0) return
  throw brokenCatalog(
    `${modulesFolder}/${catalogFileName} does not list ${unlisted.join(', ')}`,
    `Every folder in ${modulesFolder}/ is a module and needs a place in a section of ${catalogFileName}.`,
  )
}

function checkEveryModuleIsListedOnce(modules: ModuleDefinition[]): void {
  const seen = new Set<string>()
  for (const module of modules) {
    if (seen.has(module.id)) {
      throw brokenCatalog(
        `${modulesFolder}/${catalogFileName} lists '${module.id}' twice`,
        'A module belongs to exactly one section.',
      )
    }
    seen.add(module.id)
  }
}

function checkRequirementsExist(
  modules: ModuleDefinition[],
  byId: ReadonlyMap<string, ModuleDefinition>,
): void {
  for (const module of modules) {
    const unknownRequirement = module.requires.find((required) => !byId.has(required))
    if (unknownRequirement) {
      throw brokenCatalog(
        `The module '${module.id}' requires '${unknownRequirement}', which does not exist`,
        `${modulesFolder}/${module.id}/${moduleFileName} lists '${unknownRequirement}' in requires.`,
      )
    }
  }
}

function checkNoCircularRequirements(
  modules: ModuleDefinition[],
  byId: ReadonlyMap<string, ModuleDefinition>,
): void {
  const checkedModules = new Set<string>()
  const visit = (id: string, requirementChain: string[]) => {
    if (requirementChain.includes(id)) {
      const circle = [...requirementChain.slice(requirementChain.indexOf(id)), id]
      throw brokenCatalog(
        'Modules require each other in a circle',
        `${circle.join(' → ')}. Remove one of these requirements.`,
      )
    }
    if (checkedModules.has(id)) return
    for (const required of byId.get(id)?.requires ?? []) visit(required, [...requirementChain, id])
    checkedModules.add(id)
  }
  for (const module of modules) visit(module.id, [])
}

function allRequirementsOf(id: string, byId: ReadonlyMap<string, ModuleDefinition>): string[] {
  const found = new Set<string>()
  const visit = (requiredId: string) => {
    if (found.has(requiredId)) return
    found.add(requiredId)
    for (const next of byId.get(requiredId)?.requires ?? []) visit(next)
  }
  for (const required of byId.get(id)?.requires ?? []) visit(required)
  return [...found]
}

function checkRequirementsAreCompatible(
  modules: ModuleDefinition[],
  byId: ReadonlyMap<string, ModuleDefinition>,
): void {
  for (const module of modules) {
    const withRequirements = [module.id, ...allRequirementsOf(module.id, byId)]
    const byGroup = new Map<string, string>()
    for (const id of withRequirements) {
      const group = byId.get(id)?.exclusiveGroup
      if (group === undefined) continue
      const other = byGroup.get(group)
      if (other !== undefined) {
        throw brokenCatalog(
          `The module '${module.id}' needs both '${other}' and '${id}'`,
          `They are both in the exclusive group '${group}', so only one of them can be selected. Change requires in ${modulesFolder}/${module.id}/${moduleFileName}, or the exclusiveGroup of one of them.`,
        )
      }
      byGroup.set(group, id)
    }
  }
}

function sameExclusiveGroup(first: ModuleDefinition, second: ModuleDefinition): boolean {
  return first.exclusiveGroup !== undefined && first.exclusiveGroup === second.exclusiveGroup
}

function checkInstallFoldersDoNotClash(modules: ModuleDefinition[]): void {
  const owners = new Map<string, { module: ModuleDefinition; shared: boolean }>()
  for (const module of modules) {
    for (const download of module.downloads) {
      const shared = download.sharedFolder === true
      const owner = owners.get(download.installTo)
      const clashes =
        owner !== undefined &&
        owner.module !== module &&
        !(owner.shared && shared) &&
        !sameExclusiveGroup(owner.module, module)
      if (clashes) {
        throw brokenCatalog(
          `The modules '${owner.module.id}' and '${module.id}' both install to ${download.installTo}`,
          'Installing one would replace the other. Give them different installTo folders, set sharedFolder on both downloads, or put them in the same exclusiveGroup so only one can be selected.',
        )
      }
      if (!owner) owners.set(download.installTo, { module, shared })
    }
  }
}

function checkVolumeNamesAreUnique(modules: ModuleDefinition[]): void {
  const owners = new Map<string, string>()
  for (const module of modules) {
    for (const volume of module.container.volumes) {
      const owner = owners.get(volume.name)
      if (owner !== undefined && owner !== module.id) {
        throw brokenCatalog(
          `The modules '${owner}' and '${module.id}' both have a volume named '${volume.name}'`,
          'A volume name is shared by every module of a project, so each one needs its own.',
        )
      }
      owners.set(volume.name, module.id)
    }
  }
}

export function checkModuleCatalog(
  modules: ModuleDefinition[],
  byId: ReadonlyMap<string, ModuleDefinition>,
  moduleFolders: string[],
): void {
  checkEveryModuleIsListedOnce(modules)
  checkEveryFolderIsListed(byId, moduleFolders)
  checkRequirementsExist(modules, byId)
  checkNoCircularRequirements(modules, byId)
  checkRequirementsAreCompatible(modules, byId)
  checkInstallFoldersDoNotClash(modules)
  checkVolumeNamesAreUnique(modules)
}

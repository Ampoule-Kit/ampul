import { Problem } from '../problems/Problem.ts'
import type { ModuleDefinition } from './ModuleDefinition.ts'
import { areMutuallyExclusive } from './moduleSelection.ts'
import { parseRequirement } from './moduleVersions.ts'

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

function requiredModuleIds(module: ModuleDefinition): string[] {
  const requirements = module.versions.flatMap((version) => version.requires)
  return [...new Set(requirements.map((requirement) => parseRequirement(requirement).moduleId))]
}

function checkRequirementsExist(
  modules: ModuleDefinition[],
  byId: ReadonlyMap<string, ModuleDefinition>,
): void {
  for (const module of modules) {
    const requirements = new Set(module.versions.flatMap((version) => version.requires))
    for (const requirement of requirements) {
      const { moduleId, versionId } = parseRequirement(requirement)
      const required = byId.get(moduleId)
      const where = `${modulesFolder}/${module.id}/${moduleFileName} lists '${requirement}' in requires.`
      if (!required) {
        throw brokenCatalog(
          `The module '${module.id}' requires '${moduleId}', which does not exist`,
          where,
        )
      }
      if (versionId === undefined) continue
      if (!required.versions.some((version) => version.id === versionId)) {
        throw brokenCatalog(
          `The module '${module.id}' requires version '${versionId}' of '${moduleId}', which it does not have`,
          where,
        )
      }
      if (!required.multipleVersions) {
        throw brokenCatalog(
          `The module '${module.id}' requires one version of '${moduleId}', which only installs one version at a time`,
          `${where} A version can only be required of a module with multipleVersions, so it never replaces the version picked for a project.`,
        )
      }
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
    const module = byId.get(id)
    for (const required of module ? requiredModuleIds(module) : []) {
      visit(required, [...requirementChain, id])
    }
    checkedModules.add(id)
  }
  for (const module of modules) visit(module.id, [])
}

function allRequirementsOf(id: string, byId: ReadonlyMap<string, ModuleDefinition>): string[] {
  const found = new Set<string>()
  const visit = (requiredId: string) => {
    if (found.has(requiredId)) return
    found.add(requiredId)
    const required = byId.get(requiredId)
    for (const next of required ? requiredModuleIds(required) : []) visit(next)
  }
  const module = byId.get(id)
  for (const required of module ? requiredModuleIds(module) : []) visit(required)
  return [...found]
}

function checkExclusionsExist(
  modules: ModuleDefinition[],
  byId: ReadonlyMap<string, ModuleDefinition>,
): void {
  for (const module of modules) {
    const unknown = module.mutuallyExclusiveWith.find(
      (other) => other === module.id || !byId.has(other),
    )
    if (unknown !== undefined) {
      throw brokenCatalog(
        `The module '${module.id}' is mutually exclusive with '${unknown}', which is not another module`,
        `${modulesFolder}/${module.id}/${moduleFileName} lists '${unknown}' in mutuallyExclusiveWith.`,
      )
    }
  }
}

function checkRequirementsAreCompatible(
  modules: ModuleDefinition[],
  byId: ReadonlyMap<string, ModuleDefinition>,
): void {
  for (const module of modules) {
    const needed = [module.id, ...allRequirementsOf(module.id, byId)].flatMap(
      (id) => byId.get(id) ?? [],
    )
    for (const [index, first] of needed.entries()) {
      const second = needed.slice(index + 1).find((other) => areMutuallyExclusive(first, other))
      if (second) {
        throw brokenCatalog(
          `The module '${module.id}' needs both '${first.id}' and '${second.id}'`,
          `They are mutually exclusive, so they can't be selected together. Change requires in ${modulesFolder}/${module.id}/${moduleFileName}, or mutuallyExclusiveWith in one of them.`,
        )
      }
    }
  }
}

interface FolderOwner {
  module: ModuleDefinition
  versionId: string
  shared: boolean
}

function canBeInstalledTogether(first: FolderOwner, second: FolderOwner): boolean {
  if (first.module === second.module) {
    return first.versionId !== second.versionId && first.module.multipleVersions
  }
  return !areMutuallyExclusive(first.module, second.module)
}

function checkInstallFoldersDoNotClash(modules: ModuleDefinition[]): void {
  const ownersByFolder = new Map<string, FolderOwner[]>()
  for (const module of modules) {
    for (const version of module.versions) {
      for (const download of version.downloads) {
        const candidate = { module, versionId: version.id, shared: download.sharedFolder === true }
        const owners = ownersByFolder.get(download.installTo) ?? []
        const clash = owners.find(
          (owner) =>
            canBeInstalledTogether(owner, candidate) && !(owner.shared && candidate.shared),
        )
        if (clash) {
          const names =
            clash.module === module
              ? `Versions '${clash.versionId}' and '${version.id}' of '${module.id}'`
              : `The modules '${clash.module.id}' and '${module.id}'`
          throw brokenCatalog(
            `${names} both install to ${download.installTo}`,
            'Installing one would replace the other. Give them different installTo folders, set sharedFolder on both downloads, or make them mutually exclusive so only one can be selected.',
          )
        }
        ownersByFolder.set(download.installTo, [...owners, candidate])
      }
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
  checkExclusionsExist(modules, byId)
  checkRequirementsAreCompatible(modules, byId)
  checkInstallFoldersDoNotClash(modules)
  checkVolumeNamesAreUnique(modules)
}

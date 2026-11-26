import { Problem } from '../problems/Problem.ts'
import type { ModuleDefinition } from './ModuleDefinition.ts'

export const modulesFolder = 'modules'
export const catalogFileName = 'catalog.json'
export const moduleFileName = 'module.json'

export function brokenCatalog(title: string, explanation: string): Problem {
  return new Problem(title, {
    explanation,
    fixes: [
      { description: `Fix it in the ${modulesFolder}/ folder of the devenv repo` },
      { description: 'Then build and install dev again', command: 'npm run cli:install' },
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

export function checkModuleCatalog(
  modules: ModuleDefinition[],
  byId: ReadonlyMap<string, ModuleDefinition>,
  moduleFolders: string[],
): void {
  checkEveryModuleIsListedOnce(modules)
  checkEveryFolderIsListed(byId, moduleFolders)
  checkRequirementsExist(modules, byId)
  checkNoCircularRequirements(modules, byId)
}

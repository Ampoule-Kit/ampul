import fs from 'node:fs'
import { Problem } from '../problems/Problem.js'
import { resourcePath } from '../resources/resourceDirectory.js'
import type { ModuleCatalog, ModuleDefinition, ModuleDownload } from './ModuleDefinition.js'

interface CatalogFile {
  sections: { title: string; modules: string[] }[]
}

interface ModuleFile {
  label: string
  description: string
  version?: string
  selectedByDefault?: boolean
  requires?: string[]
  group?: string
  packages?: string[]
  downloads?: ModuleDownload[]
  environment?: Record<string, string>
  path?: string[]
}

const modulesFolder = 'modules'
const catalogFile = 'catalog.json'
const moduleFile = 'module.json'

let cachedCatalog: ModuleCatalog | undefined

export function moduleCatalog(): ModuleCatalog {
  cachedCatalog ??= loadModuleCatalog()
  return cachedCatalog
}

function readJson<Shape>(...segments: string[]): Shape {
  return JSON.parse(fs.readFileSync(resourcePath(...segments), 'utf8')) as Shape
}

function brokenCatalog(title: string, explanation: string): Problem {
  return new Problem(title, {
    explanation,
    fixes: [
      { description: `Fix it in the ${modulesFolder}/ folder of the devenv repo` },
      { description: 'Then build and install dev again', command: './install.sh' },
    ],
  })
}

function loadModule(id: string, section: string): ModuleDefinition {
  if (!fs.existsSync(resourcePath(modulesFolder, id, moduleFile))) {
    throw brokenCatalog(
      `The module '${id}' has no ${moduleFile}`,
      `${modulesFolder}/${catalogFile} lists '${id}', but ${modulesFolder}/${id}/${moduleFile} does not exist.`,
    )
  }
  const file = readJson<ModuleFile>(modulesFolder, id, moduleFile)
  return {
    id,
    label: file.label,
    description: file.description,
    section,
    version: file.version,
    selectedByDefault: file.selectedByDefault ?? false,
    requires: file.requires ?? [],
    group: file.group,
    packages: file.packages ?? [],
    downloads: file.downloads ?? [],
    environment: file.environment ?? {},
    path: file.path ?? [],
    hasConfig: fs.existsSync(resourcePath(modulesFolder, id, 'config')),
    hasSetup: fs.existsSync(resourcePath(modulesFolder, id, 'setup.sh')),
  }
}

function checkEveryModuleIsListed(byId: Map<string, ModuleDefinition>): void {
  const folders = fs
    .readdirSync(resourcePath(modulesFolder), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  const unlisted = folders.filter((folder) => !byId.has(folder))
  if (unlisted.length > 0) {
    throw brokenCatalog(
      `${modulesFolder}/${catalogFile} does not list ${unlisted.join(', ')}`,
      `Every folder in ${modulesFolder}/ is a module and needs a place in a section of ${catalogFile}.`,
    )
  }
}

function checkRequirementsExist(modules: ModuleDefinition[], byId: Map<string, ModuleDefinition>) {
  for (const module of modules) {
    const unknown = module.requires.find((required) => !byId.has(required))
    if (unknown) {
      throw brokenCatalog(
        `The module '${module.id}' requires '${unknown}', which does not exist`,
        `${modulesFolder}/${module.id}/${moduleFile} lists '${unknown}' in requires.`,
      )
    }
  }
}

function checkNoCircularRequirements(
  modules: ModuleDefinition[],
  byId: Map<string, ModuleDefinition>,
): void {
  const finished = new Set<string>()
  const visit = (id: string, chain: string[]) => {
    if (chain.includes(id)) {
      throw brokenCatalog(
        'Modules require each other in a circle',
        `${[...chain.slice(chain.indexOf(id)), id].join(' → ')}. Remove one of these requirements.`,
      )
    }
    if (finished.has(id)) return
    for (const required of byId.get(id)?.requires ?? []) visit(required, [...chain, id])
    finished.add(id)
  }
  for (const module of modules) visit(module.id, [])
}

function loadModuleCatalog(): ModuleCatalog {
  const catalog = readJson<CatalogFile>(modulesFolder, catalogFile)
  const modules = catalog.sections.flatMap((section) =>
    section.modules.map((id) => loadModule(id, section.title)),
  )
  const byId = new Map(modules.map((module) => [module.id, module]))
  checkEveryModuleIsListed(byId)
  checkRequirementsExist(modules, byId)
  checkNoCircularRequirements(modules, byId)
  return { modules, byId }
}

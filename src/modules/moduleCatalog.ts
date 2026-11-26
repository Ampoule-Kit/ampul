import fs from 'node:fs'
import { z } from 'zod'
import { resourcePath } from '../resources/resourceDirectory.ts'
import type { ModuleCatalog, ModuleDefinition } from './ModuleDefinition.ts'
import {
  brokenCatalog,
  catalogFileName,
  checkModuleCatalog,
  moduleFileName,
  modulesFolder,
} from './moduleCatalogChecks.ts'
import { type ModuleFile, moduleCatalogFileSchema, moduleFileSchema } from './moduleSchema.ts'

let cachedCatalog: ModuleCatalog | undefined

export function moduleCatalog(): ModuleCatalog {
  cachedCatalog ??= loadModuleCatalog()
  return cachedCatalog
}

function readValidatedJson<Schema extends z.ZodType>(
  schema: Schema,
  relativePath: string,
): z.infer<Schema> {
  const absolutePath = resourcePath(relativePath)
  if (!fs.existsSync(absolutePath)) {
    throw brokenCatalog(
      `${relativePath} does not exist`,
      `ampul expects a file at ${relativePath}.`,
    )
  }
  let content: unknown
  try {
    content = JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  } catch (error) {
    throw brokenCatalog(
      `${relativePath} is not valid JSON`,
      error instanceof Error ? error.message : String(error),
    )
  }
  const parsed = schema.safeParse(content)
  if (!parsed.success) {
    throw brokenCatalog(`${relativePath} is not valid`, z.prettifyError(parsed.error))
  }
  return parsed.data
}

export function readModuleFile(id: string): ModuleFile {
  return readValidatedJson(moduleFileSchema, `${modulesFolder}/${id}/${moduleFileName}`)
}

function loadModule(id: string, section: string): ModuleDefinition {
  const { $schema: _schemaReference, check: _checkCommand, ...definition } = readModuleFile(id)
  return {
    ...definition,
    id,
    section,
    hasConfig: fs.existsSync(resourcePath(modulesFolder, id, 'config')),
    hasSetup: fs.existsSync(resourcePath(modulesFolder, id, 'setup.sh')),
  }
}

function moduleFolders(): string[] {
  return fs
    .readdirSync(resourcePath(modulesFolder), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

function loadModuleCatalog(): ModuleCatalog {
  const catalogFile = readValidatedJson(
    moduleCatalogFileSchema,
    `${modulesFolder}/${catalogFileName}`,
  )
  const modules = catalogFile.sections.flatMap((section) =>
    section.modules.map((id) => loadModule(id, section.title)),
  )
  const byId = new Map(modules.map((module) => [module.id, module]))
  checkModuleCatalog(modules, byId, moduleFolders())
  return { modules, byId }
}

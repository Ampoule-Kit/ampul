import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import {
  type ModuleCatalogFile,
  type ModuleFileSource,
  moduleCatalogFileSchema,
  moduleFileSourceSchema,
} from '../../src/modules/moduleSchema.ts'
import { moduleVersion, parseRequirement } from '../../src/modules/moduleVersions.ts'
import { repositoryRoot } from '../shared/repository.ts'

export const modulesDirectory = path.join(repositoryRoot, 'modules')
export const catalogFile = path.join(modulesDirectory, 'catalog.json')
const baseImageFile = path.join(repositoryRoot, 'image', 'base-image.json')

const baseImageSchema = z.strictObject({ image: z.string().min(1) })

export function moduleFilePath(moduleId: string): string {
  return path.join(modulesDirectory, moduleId, 'module.json')
}

export function moduleExists(moduleId: string): boolean {
  return fs.existsSync(moduleFilePath(moduleId))
}

function readJsonFile<Schema extends z.ZodType>(schema: Schema, file: string): z.infer<Schema> {
  const parsed = schema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')))
  if (!parsed.success) {
    throw new Error(`${path.relative(repositoryRoot, file)}:\n${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}

export function writeJsonFile(file: string, content: unknown): void {
  fs.writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`)
}

export function readModuleSource(moduleId: string): ModuleFileSource {
  return readJsonFile(moduleFileSourceSchema, moduleFilePath(moduleId))
}

export function readCatalog(): ModuleCatalogFile {
  return readJsonFile(moduleCatalogFileSchema, catalogFile)
}

export function moduleIdsInCatalogOrder(): string[] {
  return readCatalog().sections.flatMap((section) => section.modules)
}

export function readBaseImage(): string {
  return readJsonFile(baseImageSchema, baseImageFile).image
}

export function writeBaseImage(image: string): void {
  writeJsonFile(baseImageFile, { image })
}

export interface InstallStep {
  moduleId: string
  versionId: string | undefined
}

// The modules to install, requirements first. A module with versions gets the version
// asked for, else its newest.
export function modulesWithRequirements(
  roots: InstallStep[],
  readSource: (moduleId: string) => ModuleFileSource = readModuleSource,
): InstallStep[] {
  const ordered: InstallStep[] = []
  const place = (moduleId: string, askedVersionId: string | undefined) => {
    const source = readSource(moduleId)
    const versionId =
      source.versions === undefined ? undefined : moduleVersion(source, askedVersionId).id
    if (ordered.some((step) => step.moduleId === moduleId && step.versionId === versionId)) return
    for (const requirement of moduleVersion(source, versionId).requires) {
      const required = parseRequirement(requirement)
      place(required.moduleId, required.versionId)
    }
    ordered.push({ moduleId, versionId })
  }
  for (const root of roots) place(root.moduleId, root.versionId)
  return ordered
}

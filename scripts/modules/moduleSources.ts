import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import {
  type ModuleCatalogFile,
  type ModuleFileSource,
  moduleCatalogFileSchema,
  moduleFileSourceSchema,
} from '../../src/modules/moduleSchema.ts'
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

export function modulesWithRequirements(moduleIds: string[]): string[] {
  const ordered: string[] = []
  const placeAfterRequirements = (moduleId: string) => {
    if (ordered.includes(moduleId)) return
    for (const requiredId of readModuleSource(moduleId).requires ?? []) {
      placeAfterRequirements(requiredId)
    }
    ordered.push(moduleId)
  }
  moduleIds.forEach(placeAfterRequirements)
  return ordered
}

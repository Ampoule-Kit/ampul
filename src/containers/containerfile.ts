import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { ModuleDefinition } from '../modules/ModuleDefinition.ts'
import { resourcePath } from '../resources/resourceDirectory.ts'
import { ampulPaths } from '../system/platform.ts'
import { containerHome } from './naming.ts'

const downloadCacheMount = '--mount=type=cache,target=/var/cache/ampul'
const homePlaceholder = '{home}'

const baseImageFileSchema = z.strictObject({ image: z.string().min(1) })

export function baseImage(): string {
  const file = fs.readFileSync(resourcePath('image', 'base-image.json'), 'utf8')
  return baseImageFileSchema.parse(JSON.parse(file)).image
}

function readImageFile(name: string): string {
  return fs.readFileSync(resourcePath('image', name), 'utf8').trim()
}

function moduleInstructions(module: ModuleDefinition): string {
  return [
    `COPY modules/${module.id}/ /opt/ampul/modules/${module.id}/`,
    `RUN ${downloadCacheMount} /opt/ampul/install-module.sh ${module.id}`,
  ].join('\n')
}

function withHome(value: string): string {
  return value.replaceAll(homePlaceholder, containerHome())
}

function environmentInstruction(modules: ModuleDefinition[]): string | undefined {
  const variables = new Map<string, string>()
  for (const module of modules) {
    for (const [name, value] of Object.entries(module.environment)) {
      if (!variables.has(name)) variables.set(name, withHome(value))
    }
  }
  const pathEntries = [...new Set(modules.flatMap((module) => module.path.map(withHome)))]
  if (pathEntries.length > 0) variables.set('PATH', [...pathEntries, '${PATH}'].join(':'))
  if (variables.size === 0) return undefined
  const assignments = [...variables].map(([name, value]) => `${name}=${JSON.stringify(value)}`)
  return `ENV ${assignments.join(' \\\n    ')}`
}

export function containerfileFor(modules: ModuleDefinition[]): string {
  const sections = [
    readImageFile('base.Containerfile'),
    'FROM base AS ampul',
    ...modules.map(moduleInstructions),
    environmentInstruction(modules),
    readImageFile('user.Containerfile'),
  ]
  return sections.filter(Boolean).join('\n\n') + '\n'
}

export function writeContainerfile(projectName: string, modules: ModuleDefinition[]): string {
  const file = path.join(ampulPaths.cache, 'builds', `${projectName}.Containerfile`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, containerfileFor(modules))
  return file
}

import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { ModuleInstall } from '../modules/ModuleDefinition.ts'
import { resourcePath } from '../resources/resourceDirectory.ts'
import { ampulPaths } from '../system/platform.ts'
import { containerHome } from './naming.ts'

const downloadCacheMount = '--mount=type=cache,target=/var/cache/ampul'
const homePlaceholder = '{home}'
const installedModulesFile = '/opt/ampul/installed-modules'

const baseImageFileSchema = z.strictObject({ image: z.string().min(1) })

export function baseImage(): string {
  const file = fs.readFileSync(resourcePath('image', 'base-image.json'), 'utf8')
  return baseImageFileSchema.parse(JSON.parse(file)).image
}

function readImageFile(name: string): string {
  return fs.readFileSync(resourcePath('image', name), 'utf8').trim()
}

export function installCommand(install: ModuleInstall): string {
  const versionArgument = install.hasVersionChoice ? ` ${install.versionId}` : ''
  return `/opt/ampul/install-module.sh ${install.id}${versionArgument}`
}

function moduleInstructions(
  install: ModuleInstall,
  index: number,
  installs: ModuleInstall[],
): string {
  const isFirstOfModule = installs.findIndex((other) => other.id === install.id) === index
  return [
    ...(isFirstOfModule ? [`COPY modules/${install.id}/ /opt/ampul/modules/${install.id}/`] : []),
    `RUN ${downloadCacheMount} ${installCommand(install)}`,
  ].join('\n')
}

function installedModulesInstruction(modules: ModuleInstall[]): string | undefined {
  if (modules.length === 0) return undefined
  const ids = [...new Set(modules.map((module) => module.id))].join(' ')
  return `RUN printf '%s\\n' ${ids} >${installedModulesFile}`
}

function withHome(value: string): string {
  return value.replaceAll(homePlaceholder, containerHome())
}

function environmentInstruction(modules: ModuleInstall[]): string | undefined {
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

export function containerfileFor(modules: ModuleInstall[]): string {
  const sections = [
    readImageFile('base.Containerfile'),
    'FROM base AS ampul',
    ...modules.map(moduleInstructions),
    installedModulesInstruction(modules),
    environmentInstruction(modules),
    readImageFile('user.Containerfile'),
  ]
  return sections.filter(Boolean).join('\n\n') + '\n'
}

export function writeContainerfile(projectName: string, modules: ModuleInstall[]): string {
  const file = path.join(ampulPaths.cache, 'builds', `${projectName}.Containerfile`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, containerfileFor(modules))
  return file
}

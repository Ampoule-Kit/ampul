import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { Problem } from '../problems/Problem.ts'
import { ampulPaths, displayPath } from '../system/platform.ts'
import { type ProjectSettings, projectSettingsSchema } from './ProjectSettings.ts'

const settingsExtension = '.json'

export function projectSettingsFile(name: string): string {
  return path.join(ampulPaths.projects, name + settingsExtension)
}

export function projectExists(name: string): boolean {
  return fs.existsSync(projectSettingsFile(name))
}

export function listProjectNames(): string[] {
  if (!fs.existsSync(ampulPaths.projects)) return []
  const names = new Set<string>()
  for (const entry of fs.readdirSync(ampulPaths.projects)) {
    const extension = path.extname(entry)
    if (extension === settingsExtension) {
      names.add(path.basename(entry, extension))
    }
  }
  return [...names].toSorted()
}

export function listProjects(): ProjectSettings[] {
  return listProjectNames().map(loadProject)
}

function unreadableSettings(name: string, reason: string): Problem {
  const settingsFile = displayPath(projectSettingsFile(name))
  return new Problem(`The settings of '${name}' are not valid`, {
    explanation: `${settingsFile}: ${reason}`,
    fixes: [
      {
        description: 'Fix the file by hand, or set the project up again',
        command: `ampul config ${name}`,
      },
    ],
  })
}

function readStoredSettings(name: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(projectSettingsFile(name), 'utf8'))
  } catch (error) {
    throw unreadableSettings(name, error instanceof Error ? error.message : String(error))
  }
}

function loadCurrentSettings(name: string): ProjectSettings {
  const storedSettings = readStoredSettings(name)
  const current = projectSettingsSchema.safeParse(storedSettings)
  if (current.success) return current.data
  throw unreadableSettings(name, z.prettifyError(current.error))
}

export function loadProject(name: string): ProjectSettings {
  if (fs.existsSync(projectSettingsFile(name))) return loadCurrentSettings(name)
  throw projectNotFound(name)
}

export function saveProject(settings: ProjectSettings): void {
  fs.mkdirSync(ampulPaths.projects, { recursive: true })
  fs.writeFileSync(projectSettingsFile(settings.name), JSON.stringify(settings, null, 2) + '\n')
}

export function deleteProjectSettings(name: string): void {
  fs.rmSync(projectSettingsFile(name), { force: true })
}

export function deleteAllProjectSettings(): void {
  fs.rmSync(ampulPaths.projects, { recursive: true, force: true })
}

function projectNotFound(name: string): Problem {
  const knownProjects = listProjectNames()
  return new Problem(`There is no project named '${name}'`, {
    explanation:
      knownProjects.length > 0
        ? `The projects on this machine are: ${knownProjects.join(', ')}.`
        : 'No projects exist on this machine yet.',
    fixes:
      knownProjects.length > 0
        ? [{ description: 'See every project and its status', command: 'ampul ls' }]
        : [{ description: 'Create your first project', command: 'ampul new' }],
  })
}

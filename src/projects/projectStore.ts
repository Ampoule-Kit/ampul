import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { Problem } from '../problems/Problem.ts'
import { ampulPaths, displayPath } from '../system/platform.ts'
import { parseLegacySettings } from './legacySettings.ts'
import {
  type ProjectSettings,
  projectSettingsSchema,
  settingsBeforeModulesSchema,
} from './ProjectSettings.ts'
import { migrateToModules } from './settingsMigration.ts'

const settingsExtension = '.json'
const legacySettingsExtension = '.env'

export function projectSettingsFile(name: string): string {
  return path.join(ampulPaths.projects, name + settingsExtension)
}

function legacySettingsFile(name: string): string {
  return path.join(ampulPaths.projects, name + legacySettingsExtension)
}

export function projectExists(name: string): boolean {
  return fs.existsSync(projectSettingsFile(name)) || fs.existsSync(legacySettingsFile(name))
}

export function listProjectNames(): string[] {
  if (!fs.existsSync(ampulPaths.projects)) return []
  const names = new Set<string>()
  for (const entry of fs.readdirSync(ampulPaths.projects)) {
    const extension = path.extname(entry)
    if (extension === settingsExtension || extension === legacySettingsExtension) {
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
  const beforeModules = settingsBeforeModulesSchema.safeParse(storedSettings)
  if (!beforeModules.success) throw unreadableSettings(name, z.prettifyError(current.error))
  const migrated = migrateToModules(beforeModules.data)
  saveProject(migrated)
  return migrated
}

export function loadProject(name: string): ProjectSettings {
  if (fs.existsSync(projectSettingsFile(name))) return loadCurrentSettings(name)
  if (fs.existsSync(legacySettingsFile(name))) return migrateLegacySettings(name)
  throw projectNotFound(name)
}

export function saveProject(settings: ProjectSettings): void {
  fs.mkdirSync(ampulPaths.projects, { recursive: true })
  fs.writeFileSync(projectSettingsFile(settings.name), JSON.stringify(settings, null, 2) + '\n')
}

export function deleteProjectSettings(name: string): void {
  fs.rmSync(projectSettingsFile(name), { force: true })
  fs.rmSync(legacySettingsFile(name), { force: true })
}

export function deleteAllProjectSettings(): void {
  fs.rmSync(ampulPaths.projects, { recursive: true, force: true })
}

function migrateLegacySettings(name: string): ProjectSettings {
  const legacyContent = fs.readFileSync(legacySettingsFile(name), 'utf8')
  const settings = migrateToModules(parseLegacySettings(legacyContent, name))
  saveProject(settings)
  fs.rmSync(legacySettingsFile(name))
  return settings
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

import fs from 'node:fs'
import path from 'node:path'
import { Problem } from '../problems/Problem.js'
import { devenvPaths } from '../system/platform.js'
import { parseLegacySettings } from './legacySettings.js'
import type { ProjectSettings } from './ProjectSettings.js'
import {
  isFromBeforeModules,
  migrateToModules,
  type StoredProjectSettings,
} from './settingsMigration.js'

const settingsExtension = '.json'
const legacySettingsExtension = '.env'

export function projectSettingsFile(name: string): string {
  return path.join(devenvPaths.projects, name + settingsExtension)
}

function legacySettingsFile(name: string): string {
  return path.join(devenvPaths.projects, name + legacySettingsExtension)
}

export function projectExists(name: string): boolean {
  return fs.existsSync(projectSettingsFile(name)) || fs.existsSync(legacySettingsFile(name))
}

export function listProjectNames(): string[] {
  if (!fs.existsSync(devenvPaths.projects)) return []
  const names = new Set<string>()
  for (const entry of fs.readdirSync(devenvPaths.projects)) {
    const extension = path.extname(entry)
    if (extension === settingsExtension || extension === legacySettingsExtension) {
      names.add(path.basename(entry, extension))
    }
  }
  return [...names].sort()
}

export function listProjects(): ProjectSettings[] {
  return listProjectNames().map(loadProject)
}

export function loadProject(name: string): ProjectSettings {
  if (fs.existsSync(projectSettingsFile(name))) {
    const stored = JSON.parse(
      fs.readFileSync(projectSettingsFile(name), 'utf8'),
    ) as StoredProjectSettings
    if (!isFromBeforeModules(stored)) return stored
    const migrated = migrateToModules(stored)
    saveProject(migrated)
    return migrated
  }
  if (fs.existsSync(legacySettingsFile(name))) {
    return migrateLegacySettings(name)
  }
  throw projectNotFound(name)
}

export function saveProject(settings: ProjectSettings): void {
  fs.mkdirSync(devenvPaths.projects, { recursive: true })
  fs.writeFileSync(projectSettingsFile(settings.name), JSON.stringify(settings, null, 2) + '\n')
}

export function deleteProjectSettings(name: string): void {
  fs.rmSync(projectSettingsFile(name), { force: true })
  fs.rmSync(legacySettingsFile(name), { force: true })
}

export function deleteAllProjectSettings(): void {
  fs.rmSync(devenvPaths.projects, { recursive: true, force: true })
}

function migrateLegacySettings(name: string): ProjectSettings {
  const settings = migrateToModules({
    ...parseLegacySettings(fs.readFileSync(legacySettingsFile(name), 'utf8')),
    name,
  })
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
        ? [{ description: 'See every project and its status', command: 'dev ls' }]
        : [{ description: 'Create your first project', command: 'dev new' }],
  })
}

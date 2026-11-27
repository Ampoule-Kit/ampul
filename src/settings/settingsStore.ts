import fs from 'node:fs'
import path from 'node:path'
import { ampulPaths } from '../system/platform.ts'
import { parseSettingsFile, serializeSettings } from './settingsParsing.ts'
import { type AmpulSettings, defaultSettings } from './settingsSchema.ts'

let cachedSettings: AmpulSettings | undefined

export function settingsFileExists(): boolean {
  return fs.existsSync(ampulPaths.settings)
}

export function ampulSettings(): AmpulSettings {
  cachedSettings ??= settingsFileExists() ? loadSettings() : defaultSettings
  return cachedSettings
}

function loadSettings(): AmpulSettings {
  const { settings, needsRewrite } = parseSettingsFile(fs.readFileSync(ampulPaths.settings, 'utf8'))
  if (needsRewrite) saveSettings(settings)
  return settings
}

export function saveSettings(settings: AmpulSettings): void {
  fs.mkdirSync(path.dirname(ampulPaths.settings), { recursive: true })
  fs.writeFileSync(ampulPaths.settings, serializeSettings(settings))
  cachedSettings = settings
}

import fs from 'node:fs'
import { Problem } from '../problems/Problem.js'
import { devenvPaths, displayPath } from './platform.js'

export interface Preferences {
  runtime?: string
  containerUser: string
}

const defaultPreferences: Preferences = { containerUser: 'dev' }

let cachedPreferences: Preferences | undefined

export function preferences(): Preferences {
  cachedPreferences ??= loadPreferences()
  return cachedPreferences
}

function loadPreferences(): Preferences {
  if (!fs.existsSync(devenvPaths.preferences)) return defaultPreferences
  try {
    const stored = JSON.parse(fs.readFileSync(devenvPaths.preferences, 'utf8')) as Partial<Preferences>
    return { ...defaultPreferences, ...stored }
  } catch (error) {
    throw new Problem(`${displayPath(devenvPaths.preferences)} is not valid JSON`, {
      explanation: error instanceof Error ? error.message : String(error),
      fixes: [
        {
          description: 'Fix the file, or delete it to go back to the defaults',
          command: `rm ${displayPath(devenvPaths.preferences)}`,
        },
      ],
    })
  }
}

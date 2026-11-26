import fs from 'node:fs'
import { z } from 'zod'
import { Problem } from '../problems/Problem.ts'
import { ampulPaths, displayPath } from './platform.ts'

const preferencesSchema = z.object({
  runtime: z.string().optional(),
  containerUser: z.string().min(1).default('dev'),
})

export type Preferences = z.infer<typeof preferencesSchema>

let cachedPreferences: Preferences | undefined

export function preferences(): Preferences {
  cachedPreferences ??= loadPreferences()
  return cachedPreferences
}

function invalidPreferences(reason: string): Problem {
  const preferencesFile = displayPath(ampulPaths.preferences)
  return new Problem(`${preferencesFile} is not valid`, {
    explanation: reason,
    fixes: [
      {
        description: 'Fix the file, or delete it to go back to the defaults',
        command: `rm ${preferencesFile}`,
      },
    ],
  })
}

function loadPreferences(): Preferences {
  if (!fs.existsSync(ampulPaths.preferences)) return preferencesSchema.parse({})
  let storedPreferences: unknown
  try {
    storedPreferences = JSON.parse(fs.readFileSync(ampulPaths.preferences, 'utf8'))
  } catch (error) {
    throw invalidPreferences(error instanceof Error ? error.message : String(error))
  }
  const parsed = preferencesSchema.safeParse(storedPreferences)
  if (!parsed.success) throw invalidPreferences(z.prettifyError(parsed.error))
  return parsed.data
}

import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { Problem, type ProblemFix } from '../problems/Problem.ts'
import { ampulPaths, displayPath } from '../system/platform.ts'
import { ampulVersion } from '../version.ts'
import { type AmpulSettings, settingsFileSchema } from './settingsSchema.ts'

export interface ParsedSettingsFile {
  settings: AmpulSettings
  needsRewrite: boolean
}

const storedVersionSchema = z.object({ ampulVersion: z.string() })

function settingsFileContent(settings: AmpulSettings): Record<string, unknown> {
  return { ampulVersion, ...settings }
}

export function serializeSettings(settings: AmpulSettings): string {
  return JSON.stringify(settingsFileContent(settings), null, 2) + '\n'
}

function settingsFileName(): string {
  return displayPath(ampulPaths.settings)
}

function startOverFix(): ProblemFix {
  return {
    description: 'Or delete it, and ampul sets you up again the next time it runs',
    command: `rm ${settingsFileName()}`,
  }
}

function notJson(reason: string): Problem {
  return new Problem(`${settingsFileName()} is not valid JSON`, {
    explanation: reason,
    fixes: [{ description: 'Fix the file by hand' }, startOverFix()],
  })
}

function invalidSettings(reason: string): Problem {
  return new Problem(`${settingsFileName()} has settings that are not valid`, {
    explanation: reason,
    fixes: [{ description: 'Fix the settings listed above' }, startOverFix()],
  })
}

function incompatibleSettings(storedVersion: string | undefined, reason: string): Problem {
  const writtenBy = storedVersion ? `ampul ${storedVersion}` : 'an unknown version of ampul'
  return new Problem(`${settingsFileName()} does not work with ampul ${ampulVersion}`, {
    explanation: `It was written by ${writtenBy}, and its settings no longer match the ones this version uses.\n${reason}`,
    fixes: [
      { description: 'Fix your settings so they match this version, as listed above' },
      startOverFix(),
    ],
  })
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw notJson(error instanceof Error ? error.message : String(error))
  }
}

function storedVersionOf(content: unknown): string | undefined {
  const parsed = storedVersionSchema.safeParse(content)
  return parsed.success ? parsed.data.ampulVersion : undefined
}

export function parseSettingsFile(text: string): ParsedSettingsFile {
  const content = parseJson(text)
  const parsed = settingsFileSchema.safeParse(content)
  if (!parsed.success) {
    const storedVersion = storedVersionOf(content)
    const reason = z.prettifyError(parsed.error)
    throw storedVersion === ampulVersion
      ? invalidSettings(reason)
      : incompatibleSettings(storedVersion, reason)
  }
  const { ampulVersion: _storedVersion, ...settings } = parsed.data
  return {
    settings,
    needsRewrite: !isDeepStrictEqual(content, settingsFileContent(settings)),
  }
}

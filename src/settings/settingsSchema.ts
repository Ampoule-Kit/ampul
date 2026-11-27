import { z } from 'zod'
import { runtimeNames } from '../engine/runtimeNames.ts'

const longestLinuxUserName = 32
const highestPort = 65_535
const linuxUserNamePattern = /^[a-z_][a-z0-9_-]*$/

export const runtimeChoices = ['auto', ...runtimeNames] as const

const containerUserSchema = z
  .string()
  .max(longestLinuxUserName, `use at most ${longestLinuxUserName} characters`)
  .regex(
    linuxUserNamePattern,
    'use lowercase letters, digits, dashes and underscores, starting with a letter or an underscore',
  )
  .refine((name) => name !== 'root', 'root already exists in every container')

export const ampulSettingsSchema = z.strictObject({
  runtime: z.enum(runtimeChoices).default('auto'),
  containerUser: containerUserSchema.default('dev'),
  ignoredPorts: z.array(z.int().min(1).max(highestPort)).default([]),
})

export const settingsFileSchema = ampulSettingsSchema.extend({
  ampulVersion: z.string().min(1).optional(),
})

export type RuntimeChoice = (typeof runtimeChoices)[number]
export type AmpulSettings = z.infer<typeof ampulSettingsSchema>

export const defaultSettings: AmpulSettings = ampulSettingsSchema.parse({})

export function containerUserProblem(name: string): string | undefined {
  const parsed = containerUserSchema.safeParse(name)
  return parsed.success ? undefined : parsed.error.issues[0]?.message
}

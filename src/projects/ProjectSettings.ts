import { z } from 'zod'

const highestPortNumber = 65_535

const repositoriesSourceSchema = z.object({
  kind: z.literal('repositories'),
  repositories: z.array(z.string().min(1)),
})

const mountedFoldersSourceSchema = z.object({
  kind: z.literal('folders'),
  folders: z.array(z.string().min(1)),
})

const passThroughSourceSchema = z.object({
  kind: z.literal('pass-through'),
})

const copiedFolderSourceSchema = z
  .object({ kind: z.literal('folder'), folder: z.string().min(1) })
  .transform(({ folder }): MountedFoldersSource => ({ kind: 'folders', folders: [folder] }))

export const codeSourceSchema = z.union([
  repositoriesSourceSchema,
  mountedFoldersSourceSchema,
  passThroughSourceSchema,
  copiedFolderSourceSchema,
])

const portNumberSchema = z.int().min(1).max(highestPortNumber)

export const projectSettingsSchema = z.object({
  name: z.string().min(1),
  codeSource: codeSourceSchema,
  modules: z.array(z.string()),
  ports: z.array(portNumberSchema),
})

function upperSnakeCase(name: string): string {
  return name.replaceAll(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()
}

function words(value: string): string[] {
  return value.split(/\s+/).filter(Boolean)
}

export const settingsBeforeModulesSchema = projectSettingsSchema
  .omit({ modules: true })
  .extend({ optionalDependencies: z.record(z.string(), z.string()).default({}) })
  .catchall(z.unknown())
  .transform(({ name, codeSource, ports, optionalDependencies, ...otherSettings }) => {
    const listSettings = Object.entries(otherSettings).flatMap(([setting, value]) => {
      const list = z.array(z.string()).safeParse(value)
      return list.success ? [[upperSnakeCase(setting), list.data] as const] : []
    })
    const entries: (readonly [string, string[]])[] = [
      ...Object.entries(optionalDependencies).map(
        ([setting, value]) => [setting, words(value)] as const,
      ),
      ...listSettings,
    ]
    const legacySettings: Record<string, string[]> = Object.fromEntries(entries)
    return { name, codeSource, ports, legacySettings }
  })

export type RepositoriesSource = z.infer<typeof repositoriesSourceSchema>
export type MountedFoldersSource = z.infer<typeof mountedFoldersSourceSchema>
export type CodeSource = z.infer<typeof codeSourceSchema>
export type ProjectSettings = z.infer<typeof projectSettingsSchema>
export type SettingsBeforeModules = z.infer<typeof settingsBeforeModulesSchema>

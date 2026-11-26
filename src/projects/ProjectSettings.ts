import { z } from 'zod'

const highestPortNumber = 65_535

const repositoriesSourceSchema = z.object({
  kind: z.literal('repositories'),
  repositories: z.array(z.string().min(1)),
})

const folderSourceSchema = z.object({
  kind: z.literal('folder'),
  folder: z.string().min(1),
  onlyGitFiles: z.boolean(),
})

export const codeSourceSchema = z.discriminatedUnion('kind', [
  repositoriesSourceSchema,
  folderSourceSchema,
])

const portNumberSchema = z.int().min(1).max(highestPortNumber)

export const projectSettingsSchema = z.object({
  name: z.string().min(1),
  codeSource: codeSourceSchema,
  modules: z.array(z.string()),
  ports: z.array(portNumberSchema),
})

export const settingsBeforeModulesSchema = projectSettingsSchema.omit({ modules: true }).extend({
  dotnetSdks: z.array(z.string()).default([]),
  optionalDependencies: z.record(z.string(), z.string()).default({}),
})

export type RepositoriesSource = z.infer<typeof repositoriesSourceSchema>
export type FolderSource = z.infer<typeof folderSourceSchema>
export type CodeSource = z.infer<typeof codeSourceSchema>
export type ProjectSettings = z.infer<typeof projectSettingsSchema>
export type SettingsBeforeModules = z.infer<typeof settingsBeforeModulesSchema>

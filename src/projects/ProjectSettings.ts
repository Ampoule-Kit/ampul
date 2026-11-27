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

export const settingsBeforeModulesSchema = projectSettingsSchema.omit({ modules: true }).extend({
  dotnetSdks: z.array(z.string()).default([]),
  optionalDependencies: z.record(z.string(), z.string()).default({}),
})

export type RepositoriesSource = z.infer<typeof repositoriesSourceSchema>
export type MountedFoldersSource = z.infer<typeof mountedFoldersSourceSchema>
export type CodeSource = z.infer<typeof codeSourceSchema>
export type ProjectSettings = z.infer<typeof projectSettingsSchema>
export type SettingsBeforeModules = z.infer<typeof settingsBeforeModulesSchema>

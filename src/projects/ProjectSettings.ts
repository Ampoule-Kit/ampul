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

export const codeSourceSchema = z.union([
  repositoriesSourceSchema,
  mountedFoldersSourceSchema,
  passThroughSourceSchema,
])

const portNumberSchema = z.int().min(1).max(highestPortNumber)

export const projectSettingsSchema = z.object({
  name: z.string().min(1),
  codeSource: codeSourceSchema,
  modules: z.array(z.string()),
  ports: z.array(portNumberSchema),
})

export type RepositoriesSource = z.infer<typeof repositoriesSourceSchema>
export type MountedFoldersSource = z.infer<typeof mountedFoldersSourceSchema>
export type CodeSource = z.infer<typeof codeSourceSchema>
export type ProjectSettings = z.infer<typeof projectSettingsSchema>

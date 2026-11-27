import { z } from 'zod'

export const supportedArchitectures = ['arm64', 'amd64'] as const
export type Architecture = (typeof supportedArchitectures)[number]

const perArchitecture = <Value extends z.ZodType>(value: Value) =>
  z.strictObject({ arm64: value, amd64: value })

const sha256Checksum = z.string().regex(/^[0-9a-f]{64}$/, 'a sha256 checksum is 64 hex digits')
const sha512Checksum = z.string().regex(/^[0-9a-f]{128}$/, 'a sha512 checksum is 128 hex digits')
const moduleId = z.string().regex(/^[a-z][a-z0-9-]*$/, 'use lowercase letters, digits and dashes')
const simpleName = z.string().regex(/^[a-z][a-z0-9-]*$/, 'use lowercase letters, digits and dashes')

export const latestVersionSchema = z.strictObject({
  url: z.url({ protocol: /^https$/ }),
  match: z.string().min(1),
})

const commandLinkSchema = z.union([
  z.string().min(1),
  z.strictObject({ path: z.string().min(1), as: z.string().min(1) }),
])

export const moduleDownloadSchema = z
  .strictObject({
    name: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
    url: z.url({ protocol: /^https$/ }),
    architectures: perArchitecture(z.string().min(1)),
    sha256: perArchitecture(sha256Checksum).optional(),
    sha512: perArchitecture(sha512Checksum).optional(),
    installTo: z.string().startsWith('/'),
    sharedFolder: z.boolean().optional(),
    fileName: z.string().min(1).optional(),
    commands: z.array(commandLinkSchema).optional(),
    latestVersion: latestVersionSchema.optional(),
  })
  .refine((download) => download.sha256 ?? download.sha512, {
    message: 'every download needs a sha256 or sha512 checksum for both architectures',
  })

export const moduleVolumeSchema = z.strictObject({
  name: simpleName,
  path: z.string().startsWith('/'),
  contents: z.string().min(1),
})

export const moduleContainerSchema = z.strictObject({
  privileged: z.boolean().optional(),
  volumes: z.array(moduleVolumeSchema).optional(),
})

export const legacySettingSchema = z.strictObject({
  setting: z.string().regex(/^[A-Z0-9_]+$/, 'legacy settings are UPPER_CASE names'),
  value: z.string().min(1).optional(),
})

export const moduleFileSourceSchema = z.strictObject({
  $schema: z.string().optional(),
  label: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1).optional(),
  selectedByDefault: z.boolean().optional(),
  requires: z.array(moduleId).optional(),
  exclusiveGroup: simpleName.optional(),
  packages: z.array(z.string().min(1)).optional(),
  downloads: z.array(moduleDownloadSchema).optional(),
  environment: z.record(z.string(), z.string()).optional(),
  path: z.array(z.string().min(1)).optional(),
  container: moduleContainerSchema.optional(),
  latestVersion: latestVersionSchema.optional(),
  legacySettings: z.array(legacySettingSchema).optional(),
  check: z.string().min(1),
})

export const moduleFileSchema = moduleFileSourceSchema.transform((source) => ({
  ...source,
  selectedByDefault: source.selectedByDefault ?? false,
  requires: source.requires ?? [],
  packages: source.packages ?? [],
  downloads: source.downloads ?? [],
  environment: source.environment ?? {},
  path: source.path ?? [],
  container: {
    privileged: source.container?.privileged ?? false,
    volumes: source.container?.volumes ?? [],
  },
  legacySettings: source.legacySettings ?? [],
}))

export const moduleCatalogFileSchema = z.strictObject({
  sections: z.array(z.strictObject({ title: z.string().min(1), modules: z.array(moduleId) })),
})

export type LatestVersionSource = z.infer<typeof latestVersionSchema>
export type ModuleVolume = z.infer<typeof moduleVolumeSchema>
export type ModuleDownload = z.infer<typeof moduleDownloadSchema>
export type ModuleFileSource = z.infer<typeof moduleFileSourceSchema>
export type ModuleFile = z.infer<typeof moduleFileSchema>
export type ModuleCatalogFile = z.infer<typeof moduleCatalogFileSchema>

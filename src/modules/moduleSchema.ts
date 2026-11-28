import { z } from 'zod'

export const supportedArchitectures = ['arm64', 'amd64'] as const
export type Architecture = (typeof supportedArchitectures)[number]

const perArchitecture = <Value extends z.ZodType>(value: Value) =>
  z.strictObject({ arm64: value, amd64: value })

const sha256Checksum = z.string().regex(/^[0-9a-f]{64}$/, 'a sha256 checksum is 64 hex digits')
const sha512Checksum = z.string().regex(/^[0-9a-f]{128}$/, 'a sha512 checksum is 128 hex digits')
const moduleId = z.string().regex(/^[a-z][a-z0-9-]*$/, 'use lowercase letters, digits and dashes')
const simpleName = z.string().regex(/^[a-z][a-z0-9-]*$/, 'use lowercase letters, digits and dashes')
const versionId = z
  .string()
  .regex(/^[0-9a-z][0-9a-z.-]*$/, 'use lowercase letters, digits, dots and dashes')
const requirement = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]*(@[0-9a-z][0-9a-z.-]*)?$/,
    'name a module by its id, or one of its versions as <module>@<version>',
  )

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

export const moduleVersionSchema = z.strictObject({
  id: versionId,
  label: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  latestVersion: latestVersionSchema.optional(),
  requires: z.array(requirement).optional(),
  packages: z.array(z.string().min(1)).optional(),
  downloads: z.array(moduleDownloadSchema).optional(),
  environment: z.record(z.string(), z.string()).optional(),
  path: z.array(z.string().min(1)).optional(),
})

type VersionedFields = {
  version?: string | undefined
  latestVersion?: unknown
  downloads?: { version?: string | undefined }[] | undefined
  multipleVersions?: boolean | undefined
  versions?:
    | { id: string; version?: string | undefined; downloads?: unknown[] | undefined }[]
    | undefined
}

function checkVersions(source: VersionedFields, context: z.RefinementCtx): void {
  const issue = (message: string, path: (string | number)[]) =>
    context.addIssue({ code: 'custom', message, path })
  if (source.versions === undefined) {
    if (source.multipleVersions) issue('multipleVersions needs a list of versions', ['versions'])
    return
  }
  if (source.version !== undefined) {
    issue('a module with versions gives each version its own version', ['version'])
  }
  if (source.latestVersion !== undefined) {
    issue('a module with versions gives each version its own latestVersion', ['latestVersion'])
  }
  for (const [index, download] of (source.downloads ?? []).entries()) {
    if (download.version === undefined) {
      issue('a download shared by every version needs its own name and version', [
        'downloads',
        index,
      ])
    }
  }
  const seen = new Set<string>()
  for (const [index, version] of source.versions.entries()) {
    if (seen.has(version.id))
      issue(`the version id '${version.id}' is used twice`, ['versions', index])
    seen.add(version.id)
    if (version.version === undefined && (version.downloads ?? []).length > 0) {
      issue('a version with downloads needs a version', ['versions', index, 'version'])
    }
  }
}

export const moduleFileSourceSchema = z
  .strictObject({
    $schema: z.string().optional(),
    label: z.string().min(1),
    description: z.string().min(1),
    version: z.string().min(1).optional(),
    selectedByDefault: z.boolean().optional(),
    requires: z.array(requirement).optional(),
    mutuallyExclusiveWith: z.array(moduleId).optional(),
    packages: z.array(z.string().min(1)).optional(),
    downloads: z.array(moduleDownloadSchema).optional(),
    environment: z.record(z.string(), z.string()).optional(),
    path: z.array(z.string().min(1)).optional(),
    container: moduleContainerSchema.optional(),
    latestVersion: latestVersionSchema.optional(),
    multipleVersions: z.boolean().optional(),
    versions: z.array(moduleVersionSchema).min(1).optional(),
    check: z.string().min(1),
  })
  .superRefine(checkVersions)

export const moduleFileSchema = moduleFileSourceSchema.transform((source) => ({
  ...source,
  selectedByDefault: source.selectedByDefault ?? false,
  multipleVersions: source.multipleVersions ?? false,
  requires: source.requires ?? [],
  packages: source.packages ?? [],
  downloads: source.downloads ?? [],
  environment: source.environment ?? {},
  path: source.path ?? [],
  container: {
    privileged: source.container?.privileged ?? false,
    volumes: source.container?.volumes ?? [],
  },
  mutuallyExclusiveWith: source.mutuallyExclusiveWith ?? [],
}))

export const moduleCatalogFileSchema = z.strictObject({
  sections: z.array(z.strictObject({ title: z.string().min(1), modules: z.array(moduleId) })),
})

export type LatestVersionSource = z.infer<typeof latestVersionSchema>
export type ModuleVolume = z.infer<typeof moduleVolumeSchema>
export type ModuleDownload = z.infer<typeof moduleDownloadSchema>
export type ModuleFileSource = z.infer<typeof moduleFileSourceSchema>
export type ModuleVersionSource = z.infer<typeof moduleVersionSchema>
export type ModuleFile = z.infer<typeof moduleFileSchema>
export type ModuleCatalogFile = z.infer<typeof moduleCatalogFileSchema>

export interface ModuleContainerSettings {
  privileged: boolean
  volumes: ModuleVolume[]
}

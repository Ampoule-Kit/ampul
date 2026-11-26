import type { Architecture, ModuleDownload } from './moduleSchema.ts'

export interface VersionedModule {
  version?: string | undefined
}

const archiveExtensions = /\.(tar\.gz|tgz|tar\.xz|zip)$/

export function isArchiveFile(fileName: string): boolean {
  return archiveExtensions.test(fileName)
}

function versionForms(version: string): Record<string, string> {
  return {
    '{version}': version,
    '{version:major}': version.split('.')[0] ?? version,
    '{version:url}': version.replaceAll('+', '%2B'),
    '{version:underscored}': version.replaceAll('+', '_'),
  }
}

export function downloadVersion(module: VersionedModule, download: ModuleDownload): string {
  const version = download.version ?? module.version
  if (version === undefined) {
    throw new Error(`The download ${download.url} has no version, and neither does its module`)
  }
  return version
}

export function expandDownloadText(
  text: string,
  module: VersionedModule,
  download: ModuleDownload,
  architecture: Architecture,
): string {
  const replacements = {
    ...versionForms(downloadVersion(module, download)),
    '{arch}': download.architectures[architecture],
  }
  return Object.entries(replacements).reduce(
    (expanded, [placeholder, value]) => expanded.replaceAll(placeholder, value),
    text,
  )
}

export function downloadUrl(
  module: VersionedModule,
  download: ModuleDownload,
  architecture: Architecture,
): string {
  return expandDownloadText(download.url, module, download, architecture)
}

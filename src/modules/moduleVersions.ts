import { type ModuleVersionDefinition, singleVersionId } from './ModuleDefinition.ts'
import type { ModuleFileSource } from './moduleSchema.ts'

export interface Requirement {
  moduleId: string
  versionId: string | undefined
}

export function parseRequirement(requirement: string): Requirement {
  const [moduleId = '', versionId] = requirement.split('@')
  return { moduleId, versionId }
}

function versionTextOf(source: ModuleFileSource, version: string | undefined): string {
  if (version) return version
  const namedDownloadVersions = (source.downloads ?? []).flatMap((download) =>
    download.name && download.version ? [`${download.name} ${download.version}`] : [],
  )
  if (namedDownloadVersions.length > 0) return namedDownloadVersions.join(', ')
  return (source.packages ?? []).length > 0 ? 'from Ubuntu' : ''
}

// A module's own fields are shared by all its versions. A version adds its requirements,
// packages, downloads and path to the module's, and its environment variables win.
export function moduleVersions(source: ModuleFileSource): ModuleVersionDefinition[] {
  const shared = {
    requires: source.requires ?? [],
    packages: source.packages ?? [],
    downloads: source.downloads ?? [],
    environment: source.environment ?? {},
    path: source.path ?? [],
  }
  if (source.versions === undefined) {
    return [
      {
        id: singleVersionId,
        label: versionTextOf(source, source.version) || 'from Ubuntu',
        version: source.version,
        latestVersion: source.latestVersion,
        ...shared,
      },
    ]
  }
  return source.versions.map((version) => ({
    id: version.id,
    label: version.label ?? version.id,
    version: version.version,
    latestVersion: version.latestVersion,
    requires: [...shared.requires, ...(version.requires ?? [])],
    packages: [...shared.packages, ...(version.packages ?? [])],
    downloads: [...shared.downloads, ...(version.downloads ?? [])],
    environment: { ...shared.environment, ...version.environment },
    path: [...shared.path, ...(version.path ?? [])],
  }))
}

export function moduleVersion(
  source: ModuleFileSource,
  versionId: string | undefined,
): ModuleVersionDefinition {
  const versions = moduleVersions(source)
  const found = versionId === undefined ? versions[0] : versions.find((v) => v.id === versionId)
  if (!found) throw new Error(`There is no version '${versionId}'`)
  return found
}

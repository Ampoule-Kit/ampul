import { execFileSync } from 'node:child_process'

interface ArchiveEntry {
  permissions: string
  path: string
}

const zipArchive = /\.zip$/
const executablePermissions = /^-..x/
const leadingDotSlash = /^\.\//
const trailingSlash = /\/$/

function listedEntries(archive: string): ArchiveEntry[] {
  const listing = zipArchive.test(archive)
    ? execFileSync('unzip', ['-Z', archive], { encoding: 'utf8' })
    : execFileSync('tar', ['-tvf', archive], { encoding: 'utf8' })
  return listing
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((columns) => /^[-dl]/.test(columns[0] ?? ''))
    .map((columns) => ({
      permissions: columns[0] ?? '',
      path: (columns.at(-1) ?? '').replace(leadingDotSlash, '').replace(trailingSlash, ''),
    }))
    .filter((entry) => entry.path !== '' && entry.path !== '.')
}

function withoutSingleTopLevelFolder(entries: ArchiveEntry[]): ArchiveEntry[] {
  const topLevelNames = new Set(entries.map((entry) => entry.path.split('/')[0]))
  const [onlyTopLevelName] = topLevelNames
  const isWrappedInOneFolder =
    topLevelNames.size === 1 && entries.some((entry) => entry.path.includes('/'))
  if (!isWrappedInOneFolder || onlyTopLevelName === undefined) return entries
  const folderPrefix = `${onlyTopLevelName}/`
  return entries
    .filter((entry) => entry.path !== onlyTopLevelName)
    .map((entry) => ({
      permissions: entry.permissions,
      path: entry.path.slice(folderPrefix.length),
    }))
}

export function installedPaths(archive: string): string[] {
  return withoutSingleTopLevelFolder(listedEntries(archive)).map((entry) => entry.path)
}

export function executablesIn(archive: string): string[] {
  return withoutSingleTopLevelFolder(listedEntries(archive))
    .filter((entry) => executablePermissions.test(entry.permissions))
    .map((entry) => entry.path)
}

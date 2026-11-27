import { z } from 'zod'
import { expandDownloadText } from '../../src/modules/downloadUrls.ts'
import type {
  LatestVersionSource,
  ModuleDownload,
  ModuleFileSource,
} from '../../src/modules/moduleSchema.ts'

export interface VersionTarget {
  name: string
  moduleId: string
  downloadName: string | undefined
  currentVersion: string
  lookup: VersionLookup | undefined
}

type VersionLookup =
  | { kind: 'page'; source: LatestVersionSource }
  | { kind: 'github'; repository: string; tagTemplate: string }

const githubReleaseUrl = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/releases\/download\/([^/]+)\//
const versionPlaceholder = /\{version(?::([a-z]+))?\}/g
const capturedForms = new Set<string | undefined>([undefined, 'url'])
const releaseSchema = z.object({ tag_name: z.string() })

function githubLookup(
  module: ModuleFileSource,
  download: ModuleDownload,
): VersionLookup | undefined {
  const [, repositoryTemplate, tagTemplate] = githubReleaseUrl.exec(download.url) ?? []
  if (!repositoryTemplate || !tagTemplate) return undefined
  return {
    kind: 'github',
    repository: expandDownloadText(repositoryTemplate, module, download, 'amd64'),
    tagTemplate,
  }
}

function lookupFor(
  module: ModuleFileSource,
  download: ModuleDownload | undefined,
  declared: LatestVersionSource | undefined,
): VersionLookup | undefined {
  if (declared) return { kind: 'page', source: declared }
  return download ? githubLookup(module, download) : undefined
}

export function versionTargets(moduleId: string, module: ModuleFileSource): VersionTarget[] {
  const downloads = module.downloads ?? []
  const moduleTarget: VersionTarget[] =
    module.version === undefined
      ? []
      : [
          {
            name: moduleId,
            moduleId,
            downloadName: undefined,
            currentVersion: module.version,
            lookup: lookupFor(
              module,
              downloads.find((download) => download.version === undefined),
              module.latestVersion,
            ),
          },
        ]
  const downloadTargets = downloads.flatMap((download): VersionTarget[] =>
    download.name && download.version
      ? [
          {
            name: `${moduleId}:${download.name}`,
            moduleId,
            downloadName: download.name,
            currentVersion: download.version,
            lookup: lookupFor(module, download, download.latestVersion),
          },
        ]
      : [],
  )
  return [...moduleTarget, ...downloadTargets]
}

function versionParts(version: string): (number | string)[] {
  return version
    .split(/[^0-9A-Za-z]+/)
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part))
}

function comparePartLists(first: string, second: string): number {
  const firstParts = versionParts(first)
  const secondParts = versionParts(second)
  for (let index = 0; index < Math.max(firstParts.length, secondParts.length); index++) {
    const a = firstParts[index]
    const b = secondParts[index]
    if (a === b) continue
    if (a === undefined) return -1
    if (b === undefined) return 1
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b))
  }
  return 0
}

export function compareVersions(first: string, second: string): number {
  const [firstCore = '', firstBuild = ''] = first.split('+')
  const [secondCore = '', secondBuild = ''] = second.split('+')
  return comparePartLists(firstCore, secondCore) || comparePartLists(firstBuild, secondBuild)
}

export function highestMatch(text: string, pattern: string): string | undefined {
  const versions = [...text.matchAll(new RegExp(pattern, 'gm'))].flatMap((match) =>
    match[1] ? [match[1]] : [],
  )
  return versions.toSorted(compareVersions).at(-1)
}

function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
}

export function versionFromTag(tag: string, tagTemplate: string): string | undefined {
  let pattern = ''
  let lastIndex = 0
  let captured = false
  for (const placeholder of tagTemplate.matchAll(versionPlaceholder)) {
    pattern += escapeRegExp(decodeURIComponent(tagTemplate.slice(lastIndex, placeholder.index)))
    const captures: boolean = !captured && capturedForms.has(placeholder[1])
    pattern += captures ? '(.+?)' : '.+?'
    captured ||= captures
    lastIndex = placeholder.index + placeholder[0].length
  }
  pattern += escapeRegExp(decodeURIComponent(tagTemplate.slice(lastIndex)))
  return new RegExp(`^${pattern}$`).exec(tag)?.[1]
}

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const response = await fetch(url, { headers, redirect: 'follow' }).catch((error: unknown) => {
    throw new Error(
      `Could not reach ${url}: ${error instanceof Error ? error.message : String(error)}`,
    )
  })
  if (!response.ok) throw new Error(`Could not read ${url}: HTTP ${response.status}`)
  return response.text()
}

function githubHeaders(): Record<string, string> {
  const token = process.env['GITHUB_TOKEN']
  return {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function latestVersion(target: VersionTarget): Promise<string> {
  const { lookup } = target
  if (!lookup) {
    throw new Error(
      `${target.name} does not say where to find its latest version. Add latestVersion to its module.json, or give the version to pin.`,
    )
  }
  if (lookup.kind === 'page') {
    const version = highestMatch(await fetchText(lookup.source.url), lookup.source.match)
    if (!version)
      throw new Error(`No version in ${lookup.source.url} matches ${lookup.source.match}`)
    return version
  }
  const url = `https://api.github.com/repos/${lookup.repository}/releases/latest`
  const release = releaseSchema.parse(JSON.parse(await fetchText(url, githubHeaders())))
  const version = versionFromTag(release.tag_name, lookup.tagTemplate)
  if (!version) {
    throw new Error(
      `The latest release of ${lookup.repository} is tagged ${release.tag_name}, which does not fit ${lookup.tagTemplate}`,
    )
  }
  return version
}

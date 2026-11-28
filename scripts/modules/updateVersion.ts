import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import type { ModuleDownload, ModuleFileSource } from '../../src/modules/moduleSchema.ts'
import { fail } from '../shared/terminalOutput.ts'
import { requireRunningEngine } from './containerEngine.ts'
import { pinDownload } from './downloadPinning.ts'
import { buildInstallTestBase, runInstallTest } from './installTest.ts'
import {
  compareVersions,
  latestVersion,
  type VersionTarget,
  versionTargets,
} from './latestVersions.ts'
import {
  moduleExists,
  moduleFilePath,
  moduleIdsInCatalogOrder,
  modulesWithRequirements,
  readBaseImage,
  readModuleSource,
  writeBaseImage,
  writeJsonFile,
} from './moduleSources.ts'

const usage = `Usage: npm run modules:update-version                                  List the modules and what they pin
       npm run modules:update-version -- --outdated                     Also look up the latest version of each
       npm run modules:update-version -- <module> [<version>]           Pin a module to <version>, or to its latest
       npm run modules:update-version -- <module>:<download> [<version>] Pin one named download of a module
       npm run modules:update-version -- <module>@<version-id> [<version>] Pin one version of a module with versions
       npm run modules:update-version -- --all                          Pin every outdated module to its latest
       npm run modules:update-version -- ubuntu <tag>                   Pin the base image to ubuntu:<tag>

Options:
  --skip-install-test    Don't test the install in a container

The latest version comes from the module's latestVersion (a page and a pattern) in its
module.json, or else from the latest GitHub release of its download. Set GITHUB_TOKEN
to avoid GitHub's rate limit.

Examples:
  npm run modules:update-version -- my-tool             Pin my-tool to its latest version
  npm run modules:update-version -- my-tool 1.2.3       Pin my-tool to 1.2.3
  npm run modules:update-version -- my-tool:plugin      Pin the download named plugin of my-tool
  npm run modules:update-version -- node@24             Pin Node.js 24 to its latest release

A new line of a tool (such as another LTS release) is a new entry in the versions of its
module.json: copy the entry of the line next to it, change its id, label and latestVersion,
then pin it with this command.`

const validVersion = /^[0-9A-Za-z][0-9A-Za-z.+_-]*$/
const ubuntuTagInImage = /^.*:([^@]+)@.*$/
const dockerHubRegistry = 'https://registry-1.docker.io/v2/library/ubuntu/manifests'
const dockerHubToken =
  'https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/ubuntu:pull'
const manifestListMediaTypes = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
].join(', ')
const tokenResponseSchema = z.object({ token: z.string() })
const manifestIndexSchema = z.object({
  manifests: z.array(z.object({ platform: z.object({ architecture: z.string() }).optional() })),
})

function describePins(module: ModuleFileSource): string {
  if (module.versions) {
    return module.versions.map((version) => version.version ?? version.id).join(', ')
  }
  if (module.version) return module.version
  const namedDownloads = (module.downloads ?? []).filter((download) => download.name)
  if (namedDownloads.length > 0) {
    return namedDownloads.map((download) => `${download.name} ${download.version}`).join(', ')
  }
  return `Ubuntu packages: ${(module.packages ?? []).join(' ')}`
}

function ubuntuTag(image: string): string {
  return image.replace(ubuntuTagInImage, '$1')
}

function allVersionTargets(): VersionTarget[] {
  return moduleIdsInCatalogOrder().flatMap((moduleId) =>
    versionTargets(moduleId, readModuleSource(moduleId)),
  )
}

async function latestText(target: VersionTarget): Promise<string> {
  try {
    const latest = await latestVersion(target)
    return compareVersions(latest, target.currentVersion) > 0 ? `${latest} available` : 'up to date'
  } catch (error) {
    return `unknown (${error instanceof Error ? error.message : String(error)})`
  }
}

async function listPins(withLatest: boolean): Promise<void> {
  const rows = [
    ['MODULE', 'VERSION', ...(withLatest ? ['LATEST'] : [])],
    ['ubuntu', ubuntuTag(readBaseImage())],
  ]
  for (const moduleId of moduleIdsInCatalogOrder()) {
    const module = readModuleSource(moduleId)
    const targets = versionTargets(moduleId, module)
    if (!withLatest || targets.length === 0) {
      rows.push([moduleId, describePins(module)])
      continue
    }
    for (const target of targets) {
      rows.push([target.name, target.currentVersion, await latestText(target)])
    }
  }
  const width = Math.max(...rows.map(([name = '']) => name.length)) + 2
  const versionWidth =
    Math.max(
      ...rows.filter((row) => row[2] !== undefined).map(([, version = '']) => version.length),
    ) + 2
  for (const [name = '', pins = '', latest] of rows) {
    console.log(
      latest === undefined
        ? `${name.padEnd(width)}${pins}`
        : `${name.padEnd(width)}${pins.padEnd(versionWidth)}${latest}`,
    )
  }
}

async function resolveUbuntuImage(tag: string): Promise<string> {
  console.log(`==> Resolving ubuntu:${tag}`)
  const tokenResponse = await fetch(dockerHubToken)
  if (!tokenResponse.ok) throw new Error('Could not reach Docker Hub.')
  const { token } = tokenResponseSchema.parse(await tokenResponse.json())
  const manifest = await fetch(`${dockerHubRegistry}/${tag}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: manifestListMediaTypes },
  })
  if (!manifest.ok) throw new Error(`ubuntu:${tag} does not exist on Docker Hub.`)
  const digest = manifest.headers.get('docker-content-digest')
  if (!digest) throw new Error(`Docker Hub returned no digest for ubuntu:${tag}.`)
  const architectures = new Set(
    manifestIndexSchema
      .parse(await manifest.json())
      .manifests.map((entry) => entry.platform?.architecture),
  )
  for (const required of ['arm64', 'amd64']) {
    if (!architectures.has(required)) throw new Error(`ubuntu:${tag} has no ${required} image.`)
  }
  console.log(`    ${digest}, with arm64 and amd64 images`)
  return `docker.io/library/ubuntu:${tag}@${digest}`
}

async function updateUbuntu(tag: string, skipInstallTest: boolean): Promise<void> {
  const currentTag = ubuntuTag(readBaseImage())
  const image = await resolveUbuntuImage(tag)
  if (tag.split('.')[0] !== currentTag.split('.')[0]) {
    console.log(
      `Note: this moves from Ubuntu ${currentTag} to ${tag}. Ubuntu package names in the modules' packages may differ; build a project with them to check.`,
    )
  }
  if (!skipInstallTest) {
    await buildInstallTestBase(await requireRunningEngine(), image)
    console.log('    passed')
  }
  writeBaseImage(image)
  console.log(`Pinned ubuntu to ${tag}.`)
}

interface PinScope {
  version?: string | undefined
  downloads?: ModuleDownload[] | undefined
}

function withVersion<Scope extends PinScope>(
  scope: Scope,
  downloadName: string | undefined,
  version: string,
): { updated: Scope; downloadsToPin: number[] } {
  const downloads = scope.downloads ?? []
  if (downloadName !== undefined) {
    const index = downloads.findIndex((download) => download.name === downloadName)
    if (index < 0) throw new Error(`This module has no download named '${downloadName}'.`)
    const updatedDownloads = downloads.map((download, downloadIndex) =>
      downloadIndex === index ? { ...download, version } : download,
    )
    return { updated: { ...scope, downloads: updatedDownloads }, downloadsToPin: [index] }
  }
  if (scope.version === undefined) {
    const example = downloads.find((download) => download.name)?.name ?? 'name'
    throw new Error(
      `This module pins each download on its own. Pin one with <module>:<download>, such as <module>:${example}.`,
    )
  }
  const downloadsToPin = downloads.flatMap((download, index) =>
    download.version === undefined ? [index] : [],
  )
  return { updated: { ...scope, version }, downloadsToPin }
}

async function pinDownloads<Scope extends PinScope>(
  scope: Scope,
  downloadIndexes: number[],
): Promise<Scope> {
  const downloadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ampul-pin-'))
  try {
    const downloads: ModuleDownload[] = [...(scope.downloads ?? [])]
    for (const index of downloadIndexes) {
      const download = downloads[index]
      if (!download) continue
      downloads[index] = (await pinDownload(scope, download, downloadDirectory)).pinned
    }
    return { ...scope, downloads }
  } finally {
    fs.rmSync(downloadDirectory, { recursive: true, force: true })
  }
}

let installTestBaseIsBuilt = false

async function testInstall(
  moduleId: string,
  versionIds: (string | undefined)[],
  module: ModuleFileSource,
): Promise<void> {
  const engine = await requireRunningEngine()
  if (!installTestBaseIsBuilt) {
    await buildInstallTestBase(engine, readBaseImage())
    installTestBaseIsBuilt = true
  }
  const readSource = (id: string) => (id === moduleId ? module : readModuleSource(id))
  for (const versionId of versionIds) {
    const steps = modulesWithRequirements([{ moduleId, versionId }], readSource)
    const modulesById = new Map(steps.map((step) => [step.moduleId, readSource(step.moduleId)]))
    await runInstallTest(engine, steps, modulesById, new Map([[moduleId, module]]), module.check)
  }
}

// Pinning a download every version shares tests the install of each version.
function versionsToTest(module: ModuleFileSource, versionId: string | undefined) {
  if (versionId !== undefined) return [versionId]
  return module.versions?.map((version) => version.id) ?? [undefined]
}

function pinScope(module: ModuleFileSource, versionId: string | undefined): PinScope {
  if (versionId === undefined) return module
  const version = module.versions?.find((candidate) => candidate.id === versionId)
  if (!version) throw new Error(`This module has no version '${versionId}'.`)
  return version
}

function withPinnedScope(
  module: ModuleFileSource,
  versionId: string | undefined,
  pinned: PinScope,
): ModuleFileSource {
  if (versionId === undefined) return { ...module, ...pinned }
  const versions = module.versions ?? []
  const index = versions.findIndex((version) => version.id === versionId)
  const current = versions[index]
  if (!current) throw new Error(`This module has no version '${versionId}'.`)
  return { ...module, versions: versions.with(index, { ...current, ...pinned }) }
}

function findTarget(target: string): VersionTarget {
  const [moduleId = ''] = target.split(/[:@]/)
  if (!moduleExists(moduleId)) {
    throw new Error(
      `There is no module named '${moduleId}'. Run npm run modules:update-version to list them.`,
    )
  }
  const targets = versionTargets(moduleId, readModuleSource(moduleId))
  const found = targets.find((each) => each.name === target)
  if (found) return found
  if (targets.length === 0) {
    throw new Error(`${moduleId} only installs Ubuntu packages, so there is no version to pin.`)
  }
  throw new Error(
    `${target} has no version of its own. Pin one of: ${targets.map((each) => each.name).join(', ')}.`,
  )
}

async function updateModule(
  target: string,
  requestedVersion: string | undefined,
  skipInstallTest: boolean,
): Promise<void> {
  const { moduleId, versionId, downloadName, currentVersion } = findTarget(target)
  let version = requestedVersion
  if (version === undefined) {
    console.log(`==> Looking up the latest version of ${target}`)
    version = await latestVersion(findTarget(target))
    console.log(`    ${version}`)
    if (compareVersions(version, currentVersion) <= 0) {
      console.log(`${target} is already at ${currentVersion}, the latest version.`)
      return
    }
  }
  if (!validVersion.test(version)) throw new Error(`'${version}' is not a valid version.`)
  const module = readModuleSource(moduleId)
  const { updated, downloadsToPin } = withVersion(
    pinScope(module, versionId),
    downloadName,
    version,
  )
  console.log(`==> Downloading ${target} ${version} for arm64 and amd64`)
  const pinned = withPinnedScope(module, versionId, await pinDownloads(updated, downloadsToPin))
  if (!skipInstallTest) await testInstall(moduleId, versionsToTest(pinned, versionId), pinned)
  writeJsonFile(moduleFilePath(moduleId), pinned)
  console.log(
    `Pinned ${target} to ${version} in modules/${moduleId}/module.json. Build it into ampul with npm run cli:install, then apply it with ampul rebuild <project>.`,
  )
}

async function updateEveryOutdatedModule(skipInstallTest: boolean): Promise<void> {
  const failures: string[] = []
  for (const target of allVersionTargets()) {
    try {
      if (!target.lookup) {
        console.log(`Skipping ${target.name}: it does not say where to find its latest version.`)
        continue
      }
      await updateModule(target.name, undefined, skipInstallTest)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`  ${target.name} was not changed: ${message}`)
      failures.push(target.name)
    }
  }
  if (failures.length > 0) {
    console.error(`Not updated: ${failures.join(', ')}. Every other module is up to date.`)
    process.exitCode = 1
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'skip-install-test': { type: 'boolean', default: false },
      outdated: { type: 'boolean', default: false },
      all: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  if (values.help) {
    console.log(usage)
    return
  }
  const skipInstallTest = values['skip-install-test']
  const [target, version] = positionals
  if (values.all) {
    if (positionals.length > 0) throw new Error('--all updates every module, so name none.')
    await updateEveryOutdatedModule(skipInstallTest)
  } else if (target === undefined) {
    await listPins(values.outdated)
  } else if (positionals.length > 2) {
    console.error(usage)
    process.exitCode = 1
  } else if (target === 'ubuntu') {
    if (version === undefined) throw new Error('Give the Ubuntu tag to pin, such as 26.04.')
    await updateUbuntu(version, skipInstallTest)
  } else {
    await updateModule(target, version, skipInstallTest)
  }
}

try {
  await main()
} catch (error) {
  fail(error instanceof Error ? error.message : String(error), 'Nothing was changed.')
}

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
       npm run modules:update-version -- --all                          Pin every outdated module to its latest
       npm run modules:update-version -- ubuntu <tag>                   Pin the base image to ubuntu:<tag>

Options:
  --skip-install-test    Don't test the install in a container

The latest version comes from the module's latestVersion (a page and a pattern) in its
module.json, or else from the latest GitHub release of its download. Set GITHUB_TOKEN
to avoid GitHub's rate limit.

Examples:
  npm run modules:update-version -- lazygit
  npm run modules:update-version -- lazygit 0.67.0
  npm run modules:update-version -- container-engine:compose

A new major line of a tool installed side by side (such as another SDK channel) is a new
module: copy its folder in modules/, rename it, add it to modules/catalog.json, then pin it
with this command.`

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

function withVersion(
  module: ModuleFileSource,
  downloadName: string | undefined,
  version: string,
): { updated: ModuleFileSource; downloadsToPin: number[] } {
  const downloads = module.downloads ?? []
  if (downloadName !== undefined) {
    const index = downloads.findIndex((download) => download.name === downloadName)
    if (index < 0) throw new Error(`This module has no download named '${downloadName}'.`)
    const updatedDownloads = downloads.map((download, downloadIndex) =>
      downloadIndex === index ? { ...download, version } : download,
    )
    return { updated: { ...module, downloads: updatedDownloads }, downloadsToPin: [index] }
  }
  if (module.version === undefined) {
    const example = downloads.find((download) => download.name)?.name ?? 'name'
    throw new Error(
      `This module pins each download on its own. Pin one with <module>:<download>, such as <module>:${example}.`,
    )
  }
  const downloadsToPin = downloads.flatMap((download, index) =>
    download.version === undefined ? [index] : [],
  )
  return { updated: { ...module, version }, downloadsToPin }
}

async function pinDownloads(
  module: ModuleFileSource,
  downloadIndexes: number[],
): Promise<ModuleFileSource> {
  const downloadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ampul-pin-'))
  try {
    const downloads: ModuleDownload[] = [...(module.downloads ?? [])]
    for (const index of downloadIndexes) {
      const download = downloads[index]
      if (!download) continue
      downloads[index] = (await pinDownload(module, download, downloadDirectory)).pinned
    }
    return { ...module, downloads }
  } finally {
    fs.rmSync(downloadDirectory, { recursive: true, force: true })
  }
}

let installTestBaseIsBuilt = false

async function testInstall(moduleId: string, module: ModuleFileSource): Promise<void> {
  const engine = await requireRunningEngine()
  if (!installTestBaseIsBuilt) {
    await buildInstallTestBase(engine, readBaseImage())
    installTestBaseIsBuilt = true
  }
  const moduleIds = modulesWithRequirements([moduleId])
  const modulesById = new Map(moduleIds.map((id) => [id, readModuleSource(id)]))
  await runInstallTest(engine, moduleIds, modulesById, new Map([[moduleId, module]]), module.check)
}

function findTarget(target: string): VersionTarget {
  const [moduleId = ''] = target.split(':')
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
  const { moduleId, downloadName, currentVersion } = findTarget(target)
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
  const { updated, downloadsToPin } = withVersion(readModuleSource(moduleId), downloadName, version)
  console.log(`==> Downloading ${target} ${version} for arm64 and amd64`)
  const pinned = await pinDownloads(updated, downloadsToPin)
  if (!skipInstallTest) await testInstall(moduleId, pinned)
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

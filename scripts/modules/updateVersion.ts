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
       npm run modules:update-version -- <module> <version>            Pin a module to <version>
       npm run modules:update-version -- <module>:<download> <version> Pin one named download of a module
       npm run modules:update-version -- ubuntu <tag>                  Pin the base image to ubuntu:<tag>

Options:
  --skip-install-test    Don't test the install in a container

Examples:
  npm run modules:update-version -- neovim 0.12.7
  npm run modules:update-version -- container-engine:docker 29.11.0

A new .NET SDK channel is a new module: copy modules/dotnet-10 to modules/dotnet-<channel>,
add it to modules/catalog.json, then pin it with this command.`

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

function listPins(): void {
  const rows = [
    ['MODULE', 'VERSION'],
    ['ubuntu', ubuntuTag(readBaseImage())],
    ...moduleIdsInCatalogOrder().map((moduleId) => [
      moduleId,
      describePins(readModuleSource(moduleId)),
    ]),
  ]
  for (const [name = '', pins = ''] of rows) console.log(`${name.padEnd(18)} ${pins}`)
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
      `Note: this moves from Ubuntu ${currentTag} to ${tag}. Ubuntu package names in modules (such as libicu74 in the dotnet modules) may differ; build a project with them to check.`,
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
  const downloadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'devenv-pin-'))
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

async function testInstall(moduleId: string, module: ModuleFileSource): Promise<void> {
  const engine = await requireRunningEngine()
  await buildInstallTestBase(engine, readBaseImage())
  const moduleIds = modulesWithRequirements([moduleId])
  const modulesById = new Map(moduleIds.map((id) => [id, readModuleSource(id)]))
  await runInstallTest(engine, moduleIds, modulesById, new Map([[moduleId, module]]), module.check)
}

async function updateModule(
  target: string,
  version: string,
  skipInstallTest: boolean,
): Promise<void> {
  const [moduleId = '', downloadName] = target.split(':')
  if (!validVersion.test(version)) throw new Error(`'${version}' is not a valid version.`)
  if (!moduleExists(moduleId)) {
    throw new Error(
      `There is no module named '${moduleId}'. Run npm run modules:update-version to list them.`,
    )
  }
  const { updated, downloadsToPin } = withVersion(readModuleSource(moduleId), downloadName, version)
  if (downloadsToPin.length === 0) {
    throw new Error(`${moduleId} only installs Ubuntu packages, so there is no version to pin.`)
  }
  console.log(`==> Downloading ${target} ${version} for arm64 and amd64`)
  const pinned = await pinDownloads(updated, downloadsToPin)
  if (!skipInstallTest) await testInstall(moduleId, pinned)
  writeJsonFile(moduleFilePath(moduleId), pinned)
  console.log(
    `Pinned ${target} to ${version} in modules/${moduleId}/module.json. Build it into dev with npm run cli:install, then apply it with dev rebuild <project>.`,
  )
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'skip-install-test': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  if (values.help) {
    console.log(usage)
    return
  }
  const skipInstallTest = values['skip-install-test']
  const [target, version] = positionals
  if (target === undefined) {
    listPins()
  } else if (version === undefined || positionals.length > 2) {
    console.error(usage)
    process.exitCode = 1
  } else if (target === 'ubuntu') {
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

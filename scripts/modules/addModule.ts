import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ContainerEngine } from '../../src/engine/ContainerEngine.ts'
import { isArchiveFile } from '../../src/modules/downloadUrls.ts'
import type {
  LatestVersionSource,
  ModuleDownload,
  ModuleFileSource,
} from '../../src/modules/moduleSchema.ts'
import { fail } from '../shared/terminalOutput.ts'
import { executablesIn, installedPaths } from './archiveContents.ts'
import { requireRunningEngine } from './containerEngine.ts'
import { type DownloadedFiles, pinDownload } from './downloadPinning.ts'
import { buildInstallTestBase, runInstallTest } from './installTest.ts'
import {
  catalogFile,
  moduleExists,
  moduleFilePath,
  modulesWithRequirements,
  readBaseImage,
  readCatalog,
  readModuleSource,
  writeJsonFile,
} from './moduleSources.ts'
import { askUntilValid, askYesOrNo, closePrompts } from './prompts.ts'

interface InstallChoice {
  packages: string[]
  version: string | undefined
  latestVersion: LatestVersionSource | undefined
  download: ModuleDownload | undefined
  commandNames: string[]
}

const validModuleId = /^[a-z][a-z0-9-]*$/
const validPackageName = /^[a-z0-9][a-z0-9+.-]+$/
const validVersion = /^[0-9A-Za-z][0-9A-Za-z.+_-]*$/
const validSimpleName = /^[A-Za-z0-9_.-]+$/
const unsafeUrlCharacters = /[\s"`$\\]/

function moduleIdProblem(moduleId: string): string | undefined {
  if (!validModuleId.test(moduleId)) {
    return 'Use lowercase letters, digits and dashes, starting with a letter.'
  }
  if (fs.existsSync(path.dirname(moduleFilePath(moduleId))))
    return `modules/${moduleId} already exists.`
  return undefined
}

function simpleNameProblem(text: string): string | undefined {
  return validSimpleName.test(text)
    ? undefined
    : 'Use letters, digits, dots, dashes and underscores.'
}

function urlTemplateProblem(url: string): string | undefined {
  if (!url.startsWith('https://')) return 'The URL must start with https://.'
  if (!url.includes('{arch}')) return 'The URL must contain {arch}.'
  if (unsafeUrlCharacters.test(url)) {
    return 'The URL can’t contain spaces, quotes, backticks, $ or backslashes.'
  }
  return undefined
}

async function askSection(): Promise<string> {
  const titles = readCatalog().sections.map((section) => section.title)
  console.log('Which section of the list does it belong in?')
  for (const [index, title] of titles.entries()) console.log(`  ${index + 1}) ${title}`)
  const answer = await askUntilValid(
    'Choose a number, or type the name of a new section',
    () => undefined,
  )
  return titles[Number(answer) - 1] ?? answer
}

async function askModuleIds(question: string): Promise<string[]> {
  const answer = await askUntilValid(
    `${question}, space-separated (- for none)`,
    (text) => {
      const unknown = text
        .split(/\s+/)
        .filter((moduleId) => moduleId !== '-' && !moduleExists(moduleId))
      return unknown.length > 0
        ? `No such modules: ${unknown.join(', ')}. They are the folder names in modules/.`
        : undefined
    },
    '-',
  )
  return answer.split(/\s+/).filter((moduleId) => moduleId !== '-')
}

function regularExpressionProblem(text: string): string | undefined {
  try {
    const capturing = new RegExp(`${text}|`).exec('')?.length ?? 0
    return capturing > 1 ? undefined : 'Capture the version in ( ).'
  } catch {
    return 'That is not a valid regular expression.'
  }
}

async function askLatestVersionSource(url: string): Promise<LatestVersionSource | undefined> {
  if (url.startsWith('https://github.com/') && url.includes('/releases/download/')) {
    console.log('  The latest version will be looked up in its GitHub releases.')
    return undefined
  }
  const page = await askUntilValid(
    'A page that lists its versions, so updates can find the latest (- to skip)',
    (text) => (text === '-' || text.startsWith('https://') ? undefined : 'Use an https:// URL.'),
    '-',
  )
  if (page === '-') return undefined
  const match = await askUntilValid(
    'A regular expression that captures a version on that page, such as tool-([0-9.]+)\\.tar',
    regularExpressionProblem,
  )
  return { url: page, match }
}

async function missingUbuntuPackages(
  engine: ContainerEngine,
  packages: string[],
): Promise<string[]> {
  const { stdout } = await engine.capture([
    'run',
    '--rm',
    'ampul-install-test-base',
    'bash',
    '-c',
    'apt-get update -qq >/dev/null; for package in "$@"; do apt-cache show --no-all-versions "$package" >/dev/null 2>&1 || echo "$package"; done',
    'check-packages',
    ...packages,
  ])
  return stdout.split('\n').filter(Boolean)
}

async function askPackages(engine: ContainerEngine): Promise<string[]> {
  for (;;) {
    const packages = (
      await askUntilValid('Ubuntu packages, space-separated', (text) => {
        const invalid = text.split(/\s+/).filter((name) => !validPackageName.test(name))
        return invalid.length > 0 ? `Not valid package names: ${invalid.join(' ')}` : undefined
      })
    ).split(/\s+/)
    console.log(`==> Checking the packages exist in ${readBaseImage().replace(/@.*/, '')}`)
    const missing = await missingUbuntuPackages(engine, packages)
    if (missing.length === 0) return packages
    console.log(`  Not found in Ubuntu: ${missing.join(' ')}`)
  }
}

interface RequestedDownload {
  version: string
  download: ModuleDownload
  latestVersion: LatestVersionSource | undefined
}

async function askDownload(moduleId: string): Promise<RequestedDownload> {
  const version = await askUntilValid('Version to pin (for example 1.2.3)', (text) =>
    validVersion.test(text) ? undefined : `'${text}' is not a valid version.`,
  )
  console.log('Download URL, with {version} and {arch} where they go, for example:')
  console.log(
    '  https://github.com/owner/tool/releases/download/v{version}/tool-{version}-linux-{arch}.tar.gz',
  )
  console.log(
    '  {version:major}, {version:url} and {version:underscored} are there for versions such as 25.0.5+2.',
  )
  const url = await askUntilValid('Download URL', urlTemplateProblem)
  const latestVersion = await askLatestVersionSource(url)
  const arm64 = await askUntilValid('What {arch} is for 64-bit ARM', simpleNameProblem, 'aarch64')
  const amd64 = await askUntilValid(
    'What {arch} is for 64-bit Intel/AMD',
    simpleNameProblem,
    'x86_64',
  )
  return {
    version,
    download: { url, architectures: { arm64, amd64 }, installTo: `/opt/${moduleId}` },
    latestVersion,
  }
}

async function askArchiveCommands(files: DownloadedFiles): Promise<string[]> {
  const candidates = executablesIn(files.arm64)
  if (candidates.length > 0) {
    console.log('Executables in the archive:')
    for (const candidate of candidates.slice(0, 20)) console.log(`  ${candidate}`)
  }
  const pathsInBothArchives = new Set(
    installedPaths(files.arm64).filter((entry) => installedPaths(files.amd64).includes(entry)),
  )
  const answer = await askUntilValid(
    'Executables to put on the PATH, space-separated',
    (text) => {
      const missing = text.split(/\s+/).filter((entry) => !pathsInBothArchives.has(entry))
      return missing.length > 0 ? `Not in both archives: ${missing.join(' ')}` : undefined
    },
    candidates[0] ?? '',
  )
  return answer.split(/\s+/)
}

async function pinAndDescribeDownload(
  moduleId: string,
  requested: RequestedDownload,
): Promise<{ download: ModuleDownload; commandNames: string[] }> {
  const downloadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ampul-add-module-'))
  try {
    console.log(`==> Downloading ${moduleId} ${requested.version} for arm64 and amd64`)
    const { pinned, files } = await pinDownload(
      { version: requested.version },
      requested.download,
      downloadDirectory,
    )
    if (isArchiveFile(files.arm64)) {
      const commands = await askArchiveCommands(files)
      return { download: { ...pinned, commands }, commandNames: commands }
    }
    const fileName = await askUntilValid(
      'Command name to install it as',
      simpleNameProblem,
      moduleId,
    )
    return { download: { ...pinned, fileName, commands: [fileName] }, commandNames: [fileName] }
  } finally {
    fs.rmSync(downloadDirectory, { recursive: true, force: true })
  }
}

async function askInstallChoice(engine: ContainerEngine, moduleId: string): Promise<InstallChoice> {
  console.log('How is it installed?')
  console.log('  1) Ubuntu packages (apt)')
  console.log(
    '  2) A release download (an archive or a single executable), pinned by version and checksum',
  )
  const method = await askUntilValid(
    'Choose 1 or 2',
    (text) => (text === '1' || text === '2' ? undefined : 'Answer 1 or 2.'),
    '2',
  )
  if (method === '1') {
    return {
      packages: await askPackages(engine),
      version: undefined,
      latestVersion: undefined,
      download: undefined,
      commandNames: [],
    }
  }
  const requested = await askDownload(moduleId)
  const { download, commandNames } = await pinAndDescribeDownload(moduleId, requested)
  return {
    packages: [],
    version: requested.version,
    latestVersion: requested.latestVersion,
    download,
    commandNames,
  }
}

interface Relations {
  requires: string[]
  mutuallyExclusiveWith: string[]
}

function moduleSource(
  texts: { label: string; description: string },
  selectedByDefault: boolean,
  relations: Relations,
  install: InstallChoice,
  check: string,
): ModuleFileSource {
  const { requires, mutuallyExclusiveWith } = relations
  return {
    label: texts.label,
    description: texts.description,
    ...(install.version === undefined ? {} : { version: install.version }),
    ...(install.latestVersion ? { latestVersion: install.latestVersion } : {}),
    selectedByDefault,
    ...(requires.length > 0 ? { requires } : {}),
    ...(mutuallyExclusiveWith.length > 0 ? { mutuallyExclusiveWith } : {}),
    ...(install.packages.length > 0 ? { packages: install.packages } : {}),
    ...(install.download ? { downloads: [install.download] } : {}),
    check,
  }
}

function catalogWithModule(section: string, moduleId: string) {
  const catalog = readCatalog()
  const hasSection = catalog.sections.some((existing) => existing.title === section)
  return {
    sections: hasSection
      ? catalog.sections.map((existing) =>
          existing.title === section
            ? { ...existing, modules: [...existing.modules, moduleId] }
            : existing,
        )
      : [...catalog.sections, { title: section, modules: [moduleId] }],
  }
}

function printNextSteps(moduleId: string, section: string): void {
  console.log(`
Added the ${moduleId} module:
  modules/${moduleId}/module.json (new)
  modules/catalog.json, in the ${section} section

To go further, add to modules/${moduleId}/:
  config/     files linked into the container's home, such as config/.config/${moduleId}/ or config/.bashrc.d/${moduleId}.sh
  setup.sh    runs in the container after the config is linked, with step and warn available
  install.sh  runs at image build after the packages and downloads, for anything else
  start.sh    runs each time the container starts, for services the tool needs
and see modules/README.md for every field of module.json, such as environment and container.

Then run npm run cli:install so ampul offers it. Add it to a project with: ampul config <project>, then ampul rebuild <project>`)
}

async function addModule(): Promise<void> {
  const engine = await requireRunningEngine()
  await buildInstallTestBase(engine, readBaseImage())
  const moduleId = await askUntilValid(
    'Module name, in lowercase (for example my-tool)',
    moduleIdProblem,
  )
  const label = await askUntilValid(
    'Label shown by ampul new (for example My Tool)',
    () => undefined,
  )
  const description = await askUntilValid(
    'One sentence ampul new shows to explain it (for example The my-tool command and its plugins)',
    () => undefined,
  )
  const section = await askSection()
  const selectedByDefault = await askYesOrNo('Select it for new projects by default?', false)
  const requires = await askModuleIds('Modules it needs')
  const mutuallyExclusiveWith = await askModuleIds(
    'Modules it is mutually exclusive with, so they are never selected together',
  )
  const install = await askInstallChoice(engine, moduleId)
  const suggestedCheck = install.commandNames[0]
    ? `${install.commandNames[0].split('/').at(-1) ?? ''} --version`
    : ''
  const check = await askUntilValid(
    'Command that proves it works after installing',
    () => undefined,
    suggestedCheck,
  )
  closePrompts()

  const module = moduleSource(
    { label, description },
    selectedByDefault,
    { requires, mutuallyExclusiveWith },
    install,
    check,
  )
  const requiredSteps = modulesWithRequirements(
    requires.map((id) => ({ moduleId: id, versionId: undefined })),
  )
  const modulesById = new Map(
    requiredSteps.map((step) => [step.moduleId, readModuleSource(step.moduleId)]),
  )
  await runInstallTest(
    engine,
    [...requiredSteps, { moduleId, versionId: undefined }],
    modulesById,
    new Map([[moduleId, module]]),
    check,
  )

  fs.mkdirSync(path.dirname(moduleFilePath(moduleId)), { recursive: true })
  writeJsonFile(moduleFilePath(moduleId), module)
  writeJsonFile(catalogFile, catalogWithModule(section, moduleId))
  printNextSteps(moduleId, section)
}

try {
  await addModule()
} catch (error) {
  closePrompts()
  fail(error instanceof Error ? error.message : String(error), 'Nothing was changed.')
}

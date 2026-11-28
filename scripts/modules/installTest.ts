import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ContainerEngine } from '../../src/engine/ContainerEngine.ts'
import type { ModuleFileSource } from '../../src/modules/moduleSchema.ts'
import { moduleVersion } from '../../src/modules/moduleVersions.ts'
import { repositoryRoot } from '../shared/repository.ts'
import { type InstallStep, modulesDirectory, writeJsonFile } from './moduleSources.ts'

const installTestImage = 'ampul-install-test-base'
const installTestCacheVolume = 'ampul-install-test-cache'
const cacheLabel = 'ampul.cache=true'
const installHelpers = ['install-helpers.sh', 'module-downloads.sh', 'install-module.sh']
const testHome = '/root'
const failureOutputLines = 25

export async function buildInstallTestBase(
  engine: ContainerEngine,
  baseImage: string,
): Promise<void> {
  console.log('==> Building the base image to test installs in')
  const { exitCode, stderr } = await engine.capture([
    'build',
    '--quiet',
    '--file',
    path.join(repositoryRoot, 'image', 'base.Containerfile'),
    '--target',
    'base',
    '--tag',
    installTestImage,
    '--label',
    cacheLabel,
    '--build-arg',
    `UBUNTU_IMAGE=${baseImage}`,
    repositoryRoot,
  ])
  if (exitCode !== 0) throw new Error(`The base image did not build:\n${stderr}`)
}

function stageModules(
  moduleIds: string[],
  overrides: ReadonlyMap<string, ModuleFileSource>,
): string {
  const stagingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ampul-install-test-'))
  for (const helper of installHelpers) {
    fs.copyFileSync(path.join(repositoryRoot, 'image', helper), path.join(stagingDirectory, helper))
    fs.chmodSync(path.join(stagingDirectory, helper), 0o755)
  }
  for (const moduleId of moduleIds) {
    const stagedModule = path.join(stagingDirectory, 'modules', moduleId)
    const sourceModule = path.join(modulesDirectory, moduleId)
    if (fs.existsSync(sourceModule)) fs.cpSync(sourceModule, stagedModule, { recursive: true })
    const override = overrides.get(moduleId)
    if (override) {
      fs.mkdirSync(stagedModule, { recursive: true })
      writeJsonFile(path.join(stagedModule, 'module.json'), override)
    }
  }
  return stagingDirectory
}

function withTestHome(value: string): string {
  return value.replaceAll('{home}', testHome)
}

function environmentExports(module: ModuleFileSource, versionId: string | undefined): string[] {
  const version = moduleVersion(module, versionId)
  const variables = Object.entries(version.environment).map(
    ([name, value]) => `export ${name}='${withTestHome(value)}'`,
  )
  const pathEntries = version.path.map(withTestHome)
  return pathEntries.length > 0
    ? [...variables, `export PATH='${pathEntries.join(':')}':$PATH`]
    : variables
}

async function ensureCacheVolume(engine: ContainerEngine): Promise<void> {
  const { exitCode } = await engine.capture(['volume', 'inspect', installTestCacheVolume])
  if (exitCode !== 0) {
    await engine.capture(['volume', 'create', '--label', cacheLabel, installTestCacheVolume])
  }
}

function describeStep(step: InstallStep): string {
  return step.versionId === undefined ? step.moduleId : `${step.moduleId}@${step.versionId}`
}

export async function runInstallTest(
  engine: ContainerEngine,
  steps: InstallStep[],
  modulesById: ReadonlyMap<string, ModuleFileSource>,
  overrides: ReadonlyMap<string, ModuleFileSource>,
  checkCommand: string,
): Promise<void> {
  const testScript = [
    ...steps.flatMap(({ moduleId, versionId }) => {
      const module = overrides.get(moduleId) ?? modulesById.get(moduleId)
      const versionArgument = versionId === undefined ? '' : ` ${versionId}`
      return [
        `/opt/ampul/install-module.sh ${moduleId}${versionArgument}`,
        ...(module ? environmentExports(module, versionId) : []),
      ]
    }),
    checkCommand,
  ].join(' && ')
  const moduleIds = [...new Set(steps.map((step) => step.moduleId))]
  console.log(`==> Testing: installing ${steps.map(describeStep).join(', ')}, then ${checkCommand}`)
  await ensureCacheVolume(engine)
  const stagingDirectory = stageModules(moduleIds, overrides)
  try {
    const { exitCode, stdout, stderr } = await engine.capture([
      'run',
      '--rm',
      '--security-opt',
      'label=disable',
      '--volume',
      `${stagingDirectory}:/opt/ampul:ro`,
      '--volume',
      `${installTestCacheVolume}:/var/cache/ampul`,
      installTestImage,
      'bash',
      '-c',
      testScript,
    ])
    if (exitCode !== 0) {
      const output = `${stdout}${stderr}`.trim().split('\n').slice(-failureOutputLines).join('\n')
      throw new Error(`The install test failed. Its output:\n${output}`)
    }
    console.log('    passed')
  } finally {
    fs.rmSync(stagingDirectory, { recursive: true, force: true })
  }
}

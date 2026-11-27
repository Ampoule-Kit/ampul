import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { embeddedResourcesAssetName } from '../../src/resources/embeddedResources.ts'
import {
  binaryFileName,
  builtBinaryPath,
  isMacOS,
  isWindows,
  repositoryRoot,
} from '../shared/repository.ts'
import { bundleApplication } from './bundleApplication.ts'
import { embedResources } from './embedResources.ts'

const workDirectory = path.join(repositoryRoot, 'dist', 'build')
const bytesPerMegabyte = 1024 * 1024

const executablePermissions = 0o755
const stripArguments = isMacOS ? ['-x'] : []

function strippedRuntime(): string {
  if (isWindows) return process.execPath
  const runtimeCopy = path.join(workDirectory, `node-${binaryFileName}`)
  fs.copyFileSync(process.execPath, runtimeCopy)
  fs.chmodSync(runtimeCopy, executablePermissions)
  const strip = spawnSync('strip', [...stripArguments, runtimeCopy], { stdio: 'pipe' })
  if (strip.status === 0) return runtimeCopy
  console.log('Could not strip the Node.js runtime, so the binary keeps its debug symbols')
  return process.execPath
}

function writeSingleExecutableConfig(
  runtime: string,
  applicationBundle: string,
  resourcesFile: string,
): string {
  const configFile = path.join(workDirectory, 'sea-config.json')
  const config = {
    executable: runtime,
    main: applicationBundle,
    mainFormat: 'module',
    output: builtBinaryPath,
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    assets: { [embeddedResourcesAssetName]: resourcesFile },
  }
  fs.writeFileSync(configFile, JSON.stringify(config))
  return configFile
}

function signForMacOS(): void {
  if (!isMacOS) return
  execFileSync('codesign', ['--sign', '-', '--force', builtBinaryPath], { stdio: 'pipe' })
}

async function build(): Promise<void> {
  fs.rmSync(workDirectory, { recursive: true, force: true })
  fs.mkdirSync(workDirectory, { recursive: true })
  fs.rmSync(builtBinaryPath, { force: true })

  const applicationBundle = await bundleApplication(workDirectory)
  const resourcesFile = embedResources(workDirectory)
  const configFile = writeSingleExecutableConfig(
    strippedRuntime(),
    applicationBundle,
    resourcesFile,
  )
  execFileSync(process.execPath, ['--build-sea', configFile], { stdio: 'pipe' })
  signForMacOS()

  const megabytes = Math.round(fs.statSync(builtBinaryPath).size / bytesPerMegabyte)
  const binaryName = path.relative(repositoryRoot, builtBinaryPath)
  console.log(`Built ${binaryName} for ${process.platform}-${process.arch} (${megabytes} MB)`)
}

await build()

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { environmentVariable } from '../../src/system/environment.ts'
import { devenvPaths, homeDirectory } from '../../src/system/platform.ts'
import { binaryFileName, isWindows } from '../shared/repository.ts'

const versionCheckTimeoutMilliseconds = 10_000
const devenvVersionOutput = /^devenv \d/
const containerfilesOfTheBashVersion = ['Containerfile', 'base.Containerfile']

export const cacheDirectory = devenvPaths.cache

export function installDirectory(): string {
  const chosenDirectory = environmentVariable('DEVENV_BIN_DIR')
  if (chosenDirectory) return path.resolve(chosenDirectory)
  if (isWindows) {
    const localAppData =
      environmentVariable('LOCALAPPDATA') ?? path.join(homeDirectory, 'AppData', 'Local')
    return path.join(localAppData, 'Programs', 'devenv')
  }
  return path.join(homeDirectory, '.local', 'bin')
}

export function installedCommandPath(): string {
  return path.join(installDirectory(), binaryFileName)
}

export function installedVersion(candidate: string): string | undefined {
  const result = spawnSync(candidate, ['--version'], {
    encoding: 'utf8',
    timeout: versionCheckTimeoutMilliseconds,
  })
  const output = result.stdout.trim()
  return result.status === 0 && devenvVersionOutput.test(output) ? output : undefined
}

export function isDevenvBinary(candidate: string): boolean {
  return installedVersion(candidate) !== undefined
}

export function isLegacyScriptLink(candidate: string): boolean {
  try {
    if (!fs.lstatSync(candidate).isSymbolicLink()) return false
    const linkTarget = path.resolve(path.dirname(candidate), fs.readlinkSync(candidate))
    const linkedRepository = path.dirname(linkTarget)
    return (
      path.basename(linkTarget) === 'dev' &&
      containerfilesOfTheBashVersion.some((containerfile) =>
        fs.existsSync(path.join(linkedRepository, 'image', containerfile)),
      )
    )
  } catch {
    return false
  }
}

export function commandsOnPath(name: string): string[] {
  const directories = (environmentVariable('PATH') ?? '').split(path.delimiter).filter(Boolean)
  const extensions = isWindows ? ['.exe', '.cmd', ''] : ['']
  return directories
    .flatMap((directory) => extensions.map((extension) => path.join(directory, name + extension)))
    .filter((candidate) => fs.existsSync(candidate))
}

export function isPathTaken(target: string): boolean {
  try {
    fs.lstatSync(target)
    return true
  } catch {
    return false
  }
}

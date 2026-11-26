import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { environmentVariable } from '../../src/system/environment.ts'
import { ampulPaths, homeDirectory } from '../../src/system/platform.ts'
import { binaryFileName, isWindows } from '../shared/repository.ts'

const versionCheckTimeoutMilliseconds = 10_000
const ampulVersionOutput = /^ampul \d/

export const cacheDirectory = ampulPaths.cache

export function installDirectory(): string {
  const chosenDirectory = environmentVariable('AMPUL_BIN_DIR')
  if (chosenDirectory) return path.resolve(chosenDirectory)
  if (isWindows) {
    const localAppData =
      environmentVariable('LOCALAPPDATA') ?? path.join(homeDirectory, 'AppData', 'Local')
    return path.join(localAppData, 'Programs', 'ampul')
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
  return result.status === 0 && ampulVersionOutput.test(output) ? output : undefined
}

export function isAmpulBinary(candidate: string): boolean {
  return installedVersion(candidate) !== undefined
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

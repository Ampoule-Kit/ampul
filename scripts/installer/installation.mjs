import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const isWindows = process.platform === 'win32'
export const binaryName = isWindows ? 'dev.exe' : 'dev'
export const builtBinary = path.join(repositoryRoot, 'dist', binaryName)

const homeDirectory = os.homedir()

export function installDirectory() {
  if (process.env.DEVENV_BIN_DIR) return path.resolve(process.env.DEVENV_BIN_DIR)
  if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA ?? path.join(homeDirectory, 'AppData', 'Local')
    return path.join(localAppData, 'Programs', 'devenv')
  }
  return path.join(homeDirectory, '.local', 'bin')
}

export function displayPath(absolutePath) {
  return absolutePath.startsWith(homeDirectory + path.sep)
    ? `~${absolutePath.slice(homeDirectory.length)}`
    : absolutePath
}

export function cacheDirectory() {
  if (isWindows) {
    return path.join(
      process.env.LOCALAPPDATA ?? path.join(homeDirectory, 'AppData', 'Local'),
      'devenv',
    )
  }
  return path.join(process.env.XDG_CACHE_HOME || path.join(homeDirectory, '.cache'), 'devenv')
}

export function isDevenvBinary(candidate) {
  const result = spawnSync(candidate, ['--version'], { encoding: 'utf8', timeout: 10_000 })
  return result.status === 0 && /^devenv \d/.test(result.stdout)
}

export function isLegacyScriptLink(candidate) {
  try {
    if (!fs.lstatSync(candidate).isSymbolicLink()) return false
    const target = path.resolve(path.dirname(candidate), fs.readlinkSync(candidate))
    const linkedRepository = path.dirname(target)
    return (
      path.basename(target) === 'dev' &&
      fs.existsSync(path.join(linkedRepository, 'image', 'Containerfile'))
    )
  } catch {
    return false
  }
}

export function commandsOnPath(name) {
  const directories = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  const extensions = isWindows ? ['.exe', '.cmd', ''] : ['']
  return directories
    .flatMap((directory) => extensions.map((extension) => path.join(directory, name + extension)))
    .filter((candidate) => fs.existsSync(candidate))
}

export function compareVersions(actual, minimum) {
  const actualParts = actual.split('.').map(Number)
  const minimumParts = minimum.split('.').map(Number)
  for (let index = 0; index < minimumParts.length; index++) {
    const difference = (actualParts[index] ?? 0) - (minimumParts[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function minimumVersions() {
  const manifest = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'))
  const stripRange = (range) => range.replace(/^[^\d]*/, '')
  return {
    devenv: manifest.version,
    node: stripRange(manifest.engines.node),
    npm: stripRange(manifest.engines.npm),
  }
}

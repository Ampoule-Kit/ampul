import os from 'node:os'
import path from 'node:path'

export const isWindows = process.platform === 'win32'
export const isMacOS = process.platform === 'darwin'
export const isLinux = process.platform === 'linux'

export const homeDirectory = os.homedir()

const fallbackUserId = 1000

function windowsRoamingAppData(): string {
  return process.env.APPDATA ?? path.join(homeDirectory, 'AppData', 'Roaming')
}

function windowsLocalAppData(): string {
  return process.env.LOCALAPPDATA ?? path.join(homeDirectory, 'AppData', 'Local')
}

function xdgDirectory(environmentVariable: string, fallback: string): string {
  return process.env[environmentVariable] || path.join(homeDirectory, fallback)
}

function configRoot(): string {
  return isWindows ? windowsRoamingAppData() : xdgDirectory('XDG_CONFIG_HOME', '.config')
}

function stateRoot(): string {
  return isWindows ? windowsLocalAppData() : xdgDirectory('XDG_STATE_HOME', '.local/state')
}

function cacheRoot(): string {
  return isWindows ? windowsLocalAppData() : xdgDirectory('XDG_CACHE_HOME', '.cache')
}

export const devenvPaths = {
  config: path.join(configRoot(), 'devenv'),
  projects: path.join(configRoot(), 'devenv', 'projects'),
  preferences: path.join(configRoot(), 'devenv', 'config.json'),
  logs: path.join(stateRoot(), 'devenv', 'logs'),
  cache: path.join(cacheRoot(), 'devenv'),
}

export function hostUserId(): number {
  const { uid } = os.userInfo()
  return uid >= 0 ? uid : fallbackUserId
}

export function hostGroupId(): number {
  const { gid } = os.userInfo()
  return gid >= 0 ? gid : fallbackUserId
}

export function isRunningAsRoot(): boolean {
  return !isWindows && os.userInfo().uid === 0
}

export function displayPath(absolutePath: string): string {
  if (absolutePath === homeDirectory) return '~'
  if (absolutePath.startsWith(homeDirectory + path.sep)) {
    return '~' + absolutePath.slice(homeDirectory.length)
  }
  return absolutePath
}

export function expandHomeDirectory(enteredPath: string): string {
  if (enteredPath === '~') return homeDirectory
  if (enteredPath.startsWith('~/') || enteredPath.startsWith('~\\')) {
    return path.join(homeDirectory, enteredPath.slice(2))
  }
  return enteredPath
}

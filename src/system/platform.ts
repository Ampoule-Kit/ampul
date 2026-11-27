import os from 'node:os'
import path from 'node:path'
import { environmentVariable } from './environment.ts'

export const isWindows = process.platform === 'win32'
export const isMacOS = process.platform === 'darwin'
export const isLinux = process.platform === 'linux'

export const homeDirectory = os.homedir()

const fallbackUserId = 1000

function windowsLocalAppData(): string {
  return environmentVariable('LOCALAPPDATA') ?? path.join(homeDirectory, 'AppData', 'Local')
}

function xdgDirectory(variableName: string, fallbackUnderHome: string): string {
  return environmentVariable(variableName) ?? path.join(homeDirectory, fallbackUnderHome)
}

function configRoot(): string {
  return xdgDirectory('XDG_CONFIG_HOME', '.config')
}

function stateRoot(): string {
  return isWindows ? windowsLocalAppData() : xdgDirectory('XDG_STATE_HOME', '.local/state')
}

function cacheRoot(): string {
  return isWindows ? windowsLocalAppData() : xdgDirectory('XDG_CACHE_HOME', '.cache')
}

const configFolder = path.join(configRoot(), 'ampul')

export const ampulPaths = {
  config: configFolder,
  settings: path.join(configFolder, 'settings.json'),
  dotfiles: path.join(configFolder, 'dotfiles'),
  projects: path.join(homeDirectory, '.ampul', 'projects'),
  logs: path.join(stateRoot(), 'ampul', 'logs'),
  forwarding: path.join(stateRoot(), 'ampul', 'forwarding'),
  cache: path.join(cacheRoot(), 'ampul'),
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

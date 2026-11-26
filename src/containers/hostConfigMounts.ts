import fs from 'node:fs'
import path from 'node:path'
import { environmentVariable } from '../system/environment.ts'
import { homeDirectory } from '../system/platform.ts'
import { captureCommand } from '../system/processes.ts'
import { containerHome } from './naming.ts'

export interface HostMount {
  hostPath: string
  containerPath: string
  readOnly: boolean
}

function xdgGitConfig(): string {
  const configRoot = environmentVariable('XDG_CONFIG_HOME') ?? path.join(homeDirectory, '.config')
  return path.join(configRoot, 'git', 'config')
}

async function globalGitExcludesFile(): Promise<string | undefined> {
  const { exitCode, stdout } = await captureCommand('git', [
    'config',
    '--global',
    '--path',
    '--get',
    'core.excludesfile',
  ])
  return exitCode === 0 && stdout.trim() ? stdout.trim() : undefined
}

function isFile(candidate: string | undefined): candidate is string {
  return candidate !== undefined && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
}

function isDirectory(candidate: string): boolean {
  return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()
}

export async function hostConfigMounts(): Promise<HostMount[]> {
  const hostDirectory = `${containerHome()}/.host`
  const mounts: HostMount[] = []
  const gitConfig = path.join(homeDirectory, '.gitconfig')
  const gitCredentials = path.join(homeDirectory, '.git-credentials')
  const excludesFile = await globalGitExcludesFile()
  const sshDirectory = path.join(homeDirectory, '.ssh')

  if (isFile(gitConfig)) {
    mounts.push({
      hostPath: gitConfig,
      containerPath: `${hostDirectory}/gitconfig`,
      readOnly: true,
    })
  }
  if (isFile(xdgGitConfig())) {
    mounts.push({
      hostPath: xdgGitConfig(),
      containerPath: `${hostDirectory}/gitconfig-xdg`,
      readOnly: true,
    })
  }
  if (isFile(gitCredentials)) {
    mounts.push({
      hostPath: gitCredentials,
      containerPath: `${containerHome()}/.git-credentials`,
      readOnly: false,
    })
  }
  if (isFile(excludesFile)) {
    mounts.push({
      hostPath: excludesFile,
      containerPath: `${hostDirectory}/gitignore_global`,
      readOnly: true,
    })
  }
  if (isDirectory(sshDirectory)) {
    mounts.push({ hostPath: sshDirectory, containerPath: `${hostDirectory}/ssh`, readOnly: true })
  }
  return mounts
}

export function volumeArgument(mount: HostMount): string {
  return `${mount.hostPath}:${mount.containerPath}${mount.readOnly ? ':ro' : ''}`
}

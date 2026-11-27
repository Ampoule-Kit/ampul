import fs from 'node:fs'
import path from 'node:path'
import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import { Problem } from '../problems/Problem.ts'
import { repositoryFolderName } from '../projects/codeSources.ts'
import type { ProjectSettings } from '../projects/ProjectSettings.ts'
import { homeDirectory } from '../system/platform.ts'
import type { TaskContext } from '../tasks/TaskRunner.ts'
import type { HostMount } from './hostConfigMounts.ts'
import { containerCodeDirectory, containerName, containerUser } from './naming.ts'

export interface CloneOutcome {
  failedRepositories: string[]
}

const nonInteractiveGitEnvironment = [
  '--env',
  'GIT_TERMINAL_PROMPT=0',
  '--env',
  'GIT_SSH_COMMAND=ssh -o BatchMode=yes',
]

export function cloneCommand(
  projectName: string,
  repository: string,
  interactive: boolean,
): string[] {
  return [
    'exec',
    ...(interactive ? ['--interactive', '--tty'] : nonInteractiveGitEnvironment),
    '--user',
    containerUser(),
    '--workdir',
    containerCodeDirectory(),
    containerName(projectName),
    'git',
    'clone',
    ...(interactive ? [] : ['--progress']),
    repository,
    repositoryFolderName(repository),
  ]
}

export async function cloneRepositories(
  engine: ContainerEngine,
  project: ProjectSettings,
  repositories: string[],
  context: TaskContext,
): Promise<CloneOutcome> {
  const failedRepositories: string[] = []
  for (const [index, repository] of repositories.entries()) {
    context.detail(`${repositoryFolderName(repository)} (${index + 1} of ${repositories.length})`)
    const exitCode = await engine.stream(cloneCommand(project.name, repository, false), {
      onOutput: context.output,
      onLine: context.outputLine,
    })
    if (exitCode !== 0) failedRepositories.push(repository)
  }
  return { failedRepositories }
}

function missingFolder(project: ProjectSettings, folder: string): Problem {
  return new Problem(`${folder} no longer exists`, {
    explanation: 'The project mounts this folder, but it was moved or deleted.',
    fixes: [
      {
        description: 'Point the project at another folder',
        command: `ampul config ${project.name}`,
      },
    ],
  })
}

const emptyFoldersScript = 'for folder; do [ -n "$(ls -A "$folder")" ] || echo "$folder"; done'

function hasEntries(folder: string): boolean {
  try {
    return fs.readdirSync(folder).length > 0
  } catch {
    return false
  }
}

export async function foldersMountedEmpty(
  engine: ContainerEngine,
  project: ProjectSettings,
  mounts: HostMount[],
): Promise<string[]> {
  const mountsToCheck = mounts.filter((mount) => hasEntries(mount.hostPath))
  if (mountsToCheck.length === 0) return []
  const { stdout } = await engine.capture([
    'exec',
    containerName(project.name),
    'bash',
    '-c',
    emptyFoldersScript,
    'check',
    ...mountsToCheck.map((mount) => mount.containerPath),
  ])
  const emptyContainerPaths = new Set(stdout.split('\n').filter(Boolean))
  return mountsToCheck
    .filter((mount) => emptyContainerPaths.has(mount.containerPath))
    .map((mount) => mount.hostPath)
}

function folderMount(hostPath: string, containerPath: string): HostMount {
  return { hostPath, containerPath, readOnly: false }
}

export function codeMounts(project: ProjectSettings): HostMount[] {
  const source = project.codeSource
  if (source.kind === 'repositories') return []
  if (source.kind === 'pass-through') return [folderMount(homeDirectory, containerCodeDirectory())]
  return source.folders.map((folder) => {
    if (!fs.existsSync(folder)) throw missingFolder(project, folder)
    return folderMount(folder, `${containerCodeDirectory()}/${path.basename(folder)}`)
  })
}

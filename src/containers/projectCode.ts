import fs from 'node:fs'
import path from 'node:path'
import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import { Problem } from '../problems/Problem.ts'
import { repositoryFolderName } from '../projects/codeSources.ts'
import type { FolderSource, ProjectSettings } from '../projects/ProjectSettings.ts'
import { captureCommand } from '../system/processes.ts'
import type { TaskContext } from '../tasks/TaskRunner.ts'
import { archiveOf, replaceContainerFolder } from './archives.ts'
import { containerName, containerProjectDirectory, containerUser } from './naming.ts'

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
    containerProjectDirectory(),
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

async function filesGitWouldKeep(folder: string): Promise<string[]> {
  const { exitCode, stdout, stderr } = await captureCommand(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { workingDirectory: folder },
  )
  if (exitCode !== 0) {
    throw new Problem(`git could not list the files in ${folder}`, {
      outputTail: stderr.trim().split('\n'),
    })
  }
  const existingFiles = stdout
    .split('\0')
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(folder, file)))
  return ['.git', ...existingFiles]
}

export async function copyFolderIntoContainer(
  engine: ContainerEngine,
  project: ProjectSettings,
  source: FolderSource,
  context: TaskContext,
): Promise<void> {
  if (!fs.existsSync(source.folder)) {
    throw new Problem(`${source.folder} no longer exists`, {
      explanation: 'The project copies its code from this folder, but it was moved or deleted.',
      fixes: [
        {
          description: 'Point the project at another folder',
          command: `ampul config ${project.name}`,
        },
      ],
    })
  }
  const entries = source.onlyGitFiles ? await filesGitWouldKeep(source.folder) : ['.']
  context.detail(
    `${entries.length === 1 ? 'all files' : `${entries.length} files`} from ${source.folder}`,
  )
  const { exitCode, errorOutput } = await replaceContainerFolder(
    engine,
    project.name,
    `${containerProjectDirectory()}/${path.basename(source.folder)}`,
    archiveOf(source.folder, entries),
  )
  context.output(errorOutput)
  if (exitCode !== 0) {
    throw new Problem(`Copying ${source.folder} did not finish`, {
      outputTail: errorOutput.trim().split('\n'),
      fixes: [{ description: 'Try again', command: `ampul rebuild ${project.name}` }],
    })
  }
}

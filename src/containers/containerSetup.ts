import fs from 'node:fs'
import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import type { ModuleDefinition } from '../modules/ModuleDefinition.ts'
import { moduleCatalog } from '../modules/moduleCatalog.ts'
import { installationOrder } from '../modules/moduleSelection.ts'
import { Problem } from '../problems/Problem.ts'
import type { ProjectSettings } from '../projects/ProjectSettings.ts'
import { resourceDirectory, resourcePath } from '../resources/resourceDirectory.ts'
import { homeDirectory } from '../system/platform.ts'
import type { TaskContext } from '../tasks/TaskRunner.ts'
import { archiveOf, replaceContainerFolder } from './archives.ts'
import { containerHome, containerName, containerUser } from './naming.ts'

const setupStepPrefix = '==> '
const setupWarningPrefix = 'WARNING: '
const failedToolPrefix = 'Failed to install: '
const listedAboveMarker = ' (listed above)'

function specificWarning(warning: string, failedTools: string[]): string {
  if (!warning.includes(listedAboveMarker) || failedTools.length === 0) return warning
  return warning.replace(listedAboveMarker, `: ${failedTools.join(', ')}`)
}

function projectModules(project: ProjectSettings): ModuleDefinition[] {
  return installationOrder(project.modules, moduleCatalog())
}

function configEntries(modules: ModuleDefinition[]): string[] {
  return [
    'dotfiles',
    ...modules.filter((module) => module.hasConfig).map((module) => `modules/${module.id}/config`),
    ...modules.filter((module) => module.hasSetup).map((module) => `modules/${module.id}/setup.sh`),
  ]
}

export async function copyConfigIntoContainer(
  engine: ContainerEngine,
  project: ProjectSettings,
  context: TaskContext,
): Promise<void> {
  const { exitCode, errorOutput } = await replaceContainerFolder(
    engine,
    project.name,
    `${containerHome()}/.ampul`,
    archiveOf(resourceDirectory(), configEntries(projectModules(project))),
  )
  context.output(errorOutput)
  if (exitCode !== 0) {
    throw new Problem('The dotfiles and tool config could not be copied into the container', {
      outputTail: errorOutput.trim().split('\n'),
      fixes: [{ description: 'Try the setup again', command: `ampul setup ${project.name}` }],
    })
  }
}

export async function runContainerSetup(
  engine: ContainerEngine,
  project: ProjectSettings,
  context: TaskContext,
): Promise<void> {
  const setupScript = fs.readFileSync(resourcePath('container', 'setup.sh'))
  const failedTools: string[] = []
  const exitCode = await engine.stream(
    [
      'exec',
      '--interactive',
      '--user',
      containerUser(),
      containerName(project.name),
      'bash',
      '-s',
      '--',
      homeDirectory,
      ...projectModules(project).map((module) => module.id),
    ],
    {
      input: setupScript,
      onOutput: context.output,
      onLine: (line) => {
        if (line.startsWith(setupStepPrefix)) {
          context.detail(line.slice(setupStepPrefix.length))
        } else if (line.startsWith(setupWarningPrefix)) {
          context.warn(specificWarning(line.slice(setupWarningPrefix.length), failedTools))
        } else {
          if (line.startsWith(failedToolPrefix))
            failedTools.push(line.slice(failedToolPrefix.length))
          context.outputLine(line)
        }
      },
    },
  )
  if (exitCode !== 0) {
    throw new Problem('The in-container setup failed', {
      explanation: 'The tools, git and SSH may be only partly set up.',
      fixes: [
        {
          description: 'Read the log, then run the setup again',
          command: `ampul setup ${project.name}`,
        },
      ],
    })
  }
}

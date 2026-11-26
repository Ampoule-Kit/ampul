import fs from 'node:fs'
import type { ContainerEngine } from '../engine/ContainerEngine.js'
import { Problem } from '../problems/Problem.js'
import { resourcePath } from '../resources/resourceDirectory.js'
import { homeDirectory } from '../system/platform.js'
import type { TaskContext } from '../tasks/TaskRunner.js'
import { archiveOf, replaceContainerFolder } from './archives.js'
import { containerHome, containerName, containerUser } from './naming.js'

const setupStepPrefix = '==> '
const setupWarningPrefix = 'WARNING: '
const failedToolPrefix = 'Failed to install: '
const listedAboveMarker = ' (listed above)'

function specificWarning(warning: string, failedTools: string[]): string {
  if (!warning.includes(listedAboveMarker) || failedTools.length === 0) return warning
  return warning.replace(listedAboveMarker, `: ${failedTools.join(', ')}`)
}

export async function copyDotfilesIntoContainer(
  engine: ContainerEngine,
  projectName: string,
  context: TaskContext,
): Promise<void> {
  const { exitCode, errorOutput } = await replaceContainerFolder(
    engine,
    projectName,
    `${containerHome()}/dotfiles`,
    archiveOf(resourcePath('dotfiles')),
  )
  context.output(errorOutput)
  if (exitCode !== 0) {
    throw new Problem('The dotfiles could not be copied into the container', {
      outputTail: errorOutput.trim().split('\n'),
      fixes: [{ description: 'Try the setup again', command: `dev setup ${projectName}` }],
    })
  }
}

export async function runContainerSetup(
  engine: ContainerEngine,
  projectName: string,
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
      containerName(projectName),
      'bash',
      '-s',
      '--',
      homeDirectory,
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
      explanation: 'Neovim, git and SSH may be only partly set up.',
      fixes: [
        {
          description: 'Read the log, then run the setup again',
          command: `dev setup ${projectName}`,
        },
      ],
    })
  }
}

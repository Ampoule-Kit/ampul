import { Text } from 'ink'
import { containerState } from '../../containers/containerState.js'
import { containerName } from '../../containers/naming.js'
import { shellCommand, startContainer } from '../../containers/projectLifecycle.js'
import type { ContainerEngine } from '../../engine/ContainerEngine.js'
import { Problem } from '../../problems/Problem.js'
import type { ProjectSettings } from '../../projects/ProjectSettings.js'
import { LogFile } from '../../tasks/LogFile.js'
import { runTasks } from '../../ui/runTasks.js'
import { printElement } from '../../ui/terminal.js'
import { colors, symbols } from '../../ui/theme.js'

function containerMissing(project: ProjectSettings): Problem {
  return new Problem(`'${project.name}' has no container`, {
    explanation: 'Its settings exist, but the container was removed or never finished building.',
    fixes: [
      {
        description: 'Build the image and create the container',
        command: `dev rebuild ${project.name}`,
      },
    ],
  })
}

export async function ensureContainerRunning(
  engine: ContainerEngine,
  project: ProjectSettings,
): Promise<'already running' | 'started'> {
  const state = await containerState(engine, project.name)
  if (state === 'running') return 'already running'
  if (state === 'missing') throw containerMissing(project)

  const result = await runTasks(
    [
      {
        title: `Starting ${project.name}`,
        run: async () => {
          if (state === 'paused') {
            await engine.capture(['unpause', containerName(project.name)])
          } else {
            await startContainer(engine, project.name)
          }
        },
      },
    ],
    new LogFile(project.name, 'start'),
  )
  if (!result.succeeded && result.problem) throw result.problem
  return 'started'
}

export async function openShell(
  engine: ContainerEngine,
  project: ProjectSettings,
): Promise<number> {
  const details = [
    '~/Project',
    ...project.ports.map((port) => `localhost:${port}`),
    'leave with exit or ctrl+d',
  ]
  printElement(
    <Text>
      <Text color={colors.accent}>{symbols.arrow}</Text> Connecting to{' '}
      <Text bold>{project.name}</Text>
      <Text color={colors.muted}> {details.join('  ·  ')}</Text>
    </Text>,
  )
  const exitCode = await engine.attach(shellCommand(project.name))
  printElement(
    <Text color={colors.muted}>
      Left {project.name}. Its container keeps running; stop it with{' '}
      <Text color={colors.accent}>dev stop {project.name}</Text>
    </Text>,
  )
  return exitCode
}

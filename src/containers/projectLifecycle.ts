import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import { Problem, type ProblemFix } from '../problems/Problem.ts'
import { isPortAlreadyInUse, outputLines } from './containerErrors.ts'
import { containerName, containerProjectDirectory, containerUser } from './naming.ts'

function startFailureFixes(projectName: string, portInUse: boolean): ProblemFix[] {
  const recreate = { description: 'Recreate the container', command: `dev rebuild ${projectName}` }
  if (!portInUse) return [recreate]
  return [
    {
      description: 'Stop the program that uses the port, or change the ports',
      command: `dev config ${projectName}`,
    },
    { ...recreate, description: 'Then recreate the container' },
  ]
}

export async function startContainer(engine: ContainerEngine, projectName: string): Promise<void> {
  const { exitCode, stderr } = await engine.capture(['start', containerName(projectName)])
  if (exitCode === 0) return
  const portInUse = isPortAlreadyInUse(stderr)
  throw new Problem(`The container for '${projectName}' did not start`, {
    explanation: portInUse
      ? 'One of its ports is already used by another program or project on this machine.'
      : undefined,
    outputTail: outputLines(stderr),
    fixes: startFailureFixes(projectName, portInUse),
  })
}

export async function stopContainer(engine: ContainerEngine, projectName: string): Promise<void> {
  const { exitCode, stderr } = await engine.capture(['stop', containerName(projectName)])
  if (exitCode === 0) return
  throw new Problem(`The container for '${projectName}' did not stop`, {
    outputTail: outputLines(stderr),
    fixes: [
      {
        description: 'Force it to stop',
        command: `${engine.runtime} kill ${containerName(projectName)}`,
      },
    ],
  })
}

export function shellCommand(projectName: string): string[] {
  return [
    'exec',
    '--interactive',
    '--tty',
    '--user',
    containerUser(),
    '--workdir',
    containerProjectDirectory(),
    '--env',
    'TERM=xterm-256color',
    '--env',
    'COLORTERM=truecolor',
    containerName(projectName),
    'bash',
    '--login',
  ]
}

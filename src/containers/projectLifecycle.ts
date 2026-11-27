import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import { stopPortForwarding } from '../forwarding/portForwarding.ts'
import { Problem } from '../problems/Problem.ts'
import { hostTimeZone } from '../system/platform.ts'
import { outputLines } from './containerErrors.ts'
import { timeZoneArguments } from './containerRunArguments.ts'
import { containerCodeDirectory, containerName, containerUser } from './naming.ts'

export async function startContainer(engine: ContainerEngine, projectName: string): Promise<void> {
  const { exitCode, stderr } = await engine.capture(['start', containerName(projectName)])
  if (exitCode === 0) return
  throw new Problem(`The container for '${projectName}' did not start`, {
    outputTail: outputLines(stderr),
    fixes: [{ description: 'Recreate the container', command: `ampul rebuild ${projectName}` }],
  })
}

export async function stopContainer(engine: ContainerEngine, projectName: string): Promise<void> {
  await stopPortForwarding(projectName)
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
    containerCodeDirectory(),
    '--env',
    'TERM=xterm-256color',
    '--env',
    'COLORTERM=truecolor',
    ...timeZoneArguments(hostTimeZone()),
    containerName(projectName),
    'bash',
    '--login',
  ]
}

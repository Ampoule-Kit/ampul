import type { ContainerEngine } from '../engine/ContainerEngine.js'
import { Problem } from '../problems/Problem.js'
import {
  cacheLabel,
  containerName,
  containerProjectDirectory,
  containerUser,
  imageName,
  innerEngineVolumeName,
  projectLabel,
} from './naming.js'

export async function startContainer(engine: ContainerEngine, projectName: string): Promise<void> {
  const { exitCode, stderr } = await engine.capture(['start', containerName(projectName)])
  if (exitCode !== 0) {
    const portInUse = /address already in use|port is already allocated/i.test(stderr)
    throw new Problem(`The container for '${projectName}' did not start`, {
      explanation: portInUse
        ? 'One of its ports is already used by another program or project on this machine.'
        : undefined,
      outputTail: stderr.trim().split('\n'),
      fixes: portInUse
        ? [
            { description: 'Stop the program that uses the port, or change the ports', command: `dev config ${projectName}` },
            { description: 'Then recreate the container', command: `dev rebuild ${projectName}` },
          ]
        : [{ description: 'Recreate the container', command: `dev rebuild ${projectName}` }],
    })
  }
}

export async function stopContainer(engine: ContainerEngine, projectName: string): Promise<void> {
  const { exitCode, stderr } = await engine.capture(['stop', containerName(projectName)])
  if (exitCode !== 0) {
    throw new Problem(`The container for '${projectName}' did not stop`, {
      outputTail: stderr.trim().split('\n'),
      fixes: [{ description: 'Force it to stop', command: `${engine.runtime} kill ${containerName(projectName)}` }],
    })
  }
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

export async function removeImage(engine: ContainerEngine, projectName: string): Promise<void> {
  await engine.capture(['rmi', '--force', imageName(projectName)])
}

export async function removeInnerEngineVolume(engine: ContainerEngine, projectName: string): Promise<void> {
  const volume = innerEngineVolumeName(projectName)
  const { exitCode } = await engine.capture(['volume', 'inspect', volume])
  if (exitCode === 0) await engine.capture(['volume', 'rm', '--force', volume])
}

async function idsMatching(engine: ContainerEngine, listCommand: string[], label: string): Promise<string[]> {
  const { stdout } = await engine.capture([...listCommand, '--quiet', '--filter', `label=${label}`])
  return [...new Set(stdout.split('\n').map((id) => id.trim()).filter(Boolean))]
}

export async function removeEveryDevenvContainer(engine: ContainerEngine): Promise<void> {
  const ids = await idsMatching(engine, ['ps', '--all'], projectLabel)
  if (ids.length > 0) await engine.capture(['rm', '--force', ...ids])
}

export async function removeEveryDevenvImage(engine: ContainerEngine): Promise<void> {
  for (const label of [projectLabel, cacheLabel]) {
    const ids = await idsMatching(engine, ['images'], label)
    if (ids.length > 0) await engine.capture(['rmi', '--force', ...ids])
  }
}

export async function removeEveryDevenvVolume(engine: ContainerEngine): Promise<void> {
  for (const label of [projectLabel, cacheLabel]) {
    const names = await idsMatching(engine, ['volume', 'ls'], label)
    if (names.length > 0) await engine.capture(['volume', 'rm', '--force', ...names])
  }
}

import type { ContainerEngine } from '../engine/ContainerEngine.js'
import { Problem } from '../problems/Problem.js'
import { formatPortList, formatPortRange, portForwards, portsInRange } from '../projects/ports.js'
import type { ProjectSettings } from '../projects/ProjectSettings.js'
import type { TaskContext } from '../tasks/TaskRunner.js'
import { hostConfigMounts, volumeArgument } from './hostConfigMounts.js'
import {
  cacheLabel,
  containerHome,
  containerName,
  imageName,
  innerEngineSocket,
  innerEngineVolumeName,
  projectLabel,
  sharedCacheVolume,
} from './naming.js'

const containerEngineSetting = 'CONTAINER_ENGINE'

export function usesInnerContainerEngine(project: ProjectSettings): boolean {
  return Boolean(project.optionalDependencies[containerEngineSetting])
}

async function createVolumeIfMissing(engine: ContainerEngine, volume: string, label: string) {
  const { exitCode } = await engine.capture(['volume', 'inspect', volume])
  if (exitCode !== 0) await engine.capture(['volume', 'create', '--label', label, volume])
}

export async function removeContainer(engine: ContainerEngine, projectName: string): Promise<void> {
  await engine.capture(['rm', '--force', containerName(projectName)])
}

export async function createContainer(
  engine: ContainerEngine,
  project: ProjectSettings,
  context: TaskContext,
): Promise<void> {
  await createVolumeIfMissing(engine, sharedCacheVolume, `${cacheLabel}=true`)
  const args = [
    'run',
    '--detach',
    '--init',
    '--name',
    containerName(project.name),
    '--hostname',
    project.name,
    '--label',
    `${projectLabel}=${project.name}`,
    '--security-opt',
    'label=disable',
    '--volume',
    `${sharedCacheVolume}:${containerHome()}/.cache`,
  ]

  if (await engine.isRootlessPodman()) args.push('--userns=keep-id')

  for (const mount of await hostConfigMounts()) args.push('--volume', volumeArgument(mount))

  if (usesInnerContainerEngine(project)) {
    const engineVolume = innerEngineVolumeName(project.name)
    await createVolumeIfMissing(engine, engineVolume, `${projectLabel}=${project.name}`)
    args.push(
      '--privileged',
      '--volume',
      `${engineVolume}:/var/lib/containers`,
      '--env',
      `DOCKER_HOST=unix://${innerEngineSocket}`,
      '--env',
      `CONTAINER_HOST=unix://${innerEngineSocket}`,
      '--env',
      `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=${innerEngineSocket}`,
    )
  }

  const forwards = portForwards(project.ports)
  for (const { host, container } of forwards) {
    args.push('--publish', `127.0.0.1:${formatPortRange(host)}:${formatPortRange(container)}`)
  }
  const socatForwards = forwards.flatMap(({ host, container }) =>
    portsInRange(host).map((port, offset) => `${port}:${container.first + offset}`),
  )
  args.push('--env', `DEVENV_PORT_FORWARDS=${socatForwards.join(' ')}`, imageName(project.name))

  const { exitCode, stderr } = await engine.capture(args)
  context.output(stderr)
  if (exitCode !== 0) throw containerCreationFailed(project, stderr)
}

function containerCreationFailed(project: ProjectSettings, errorOutput: string): Problem {
  if (/address already in use|port is already allocated/i.test(errorOutput)) {
    return new Problem('A port is already in use on this machine', {
      explanation: `One of the ports ${formatPortList(project.ports)} is taken by another program or project.`,
      outputTail: errorOutput.trim().split('\n'),
      fixes: [
        {
          description: 'Stop whatever uses it, or change the ports',
          command: `dev config ${project.name}`,
        },
        { description: 'Then create the container again', command: `dev rebuild ${project.name}` },
      ],
    })
  }
  return new Problem('The container could not be created', {
    outputTail: errorOutput.trim().split('\n'),
    fixes: [{ description: 'Try again', command: `dev rebuild ${project.name}` }],
  })
}

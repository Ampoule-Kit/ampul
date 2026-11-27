import type { ModuleDefinition } from '../modules/ModuleDefinition.ts'
import type { ProjectSettings } from '../projects/ProjectSettings.ts'
import { formatPortRange, portForwards, portsInRange } from '../projects/ports.ts'
import { type HostMount, volumeArgument } from './hostConfigMounts.ts'
import {
  containerHome,
  containerName,
  imageName,
  moduleVolumeName,
  projectLabel,
  sharedCacheVolume,
} from './naming.ts'

const portForwardsVariable = 'AMPUL_PORT_FORWARDS'

export interface ContainerRunContext {
  isRootlessPodman: boolean
  hostMounts: HostMount[]
  modules: ModuleDefinition[]
}

function identityArguments(project: ProjectSettings): string[] {
  return [
    '--name',
    containerName(project.name),
    '--hostname',
    project.name,
    '--label',
    `${projectLabel}=${project.name}`,
  ]
}

function sharedCacheArguments(): string[] {
  return ['--volume', `${sharedCacheVolume}:${containerHome()}/.cache`]
}

function userNamespaceArguments(context: ContainerRunContext): string[] {
  return context.isRootlessPodman ? ['--userns=keep-id'] : []
}

function hostMountArguments(context: ContainerRunContext): string[] {
  return context.hostMounts.flatMap((mount) => ['--volume', volumeArgument(mount)])
}

function moduleArguments(project: ProjectSettings, context: ContainerRunContext): string[] {
  const privileged = context.modules.some((module) => module.container.privileged)
  const volumes = context.modules.flatMap((module) => module.container.volumes)
  return [
    ...(privileged ? ['--privileged'] : []),
    ...volumes.flatMap((volume) => [
      '--volume',
      `${moduleVolumeName(project.name, volume.name)}:${volume.path}`,
    ]),
  ]
}

function portArguments(project: ProjectSettings): string[] {
  const forwards = portForwards(project.ports)
  const publishArguments = forwards.flatMap(({ host, container }) => [
    '--publish',
    `127.0.0.1:${formatPortRange(host)}:${formatPortRange(container)}`,
  ])
  const forwardPairs = forwards.flatMap(({ host, container }) =>
    portsInRange(host).map((hostPort, offset) => `${hostPort}:${container.first + offset}`),
  )
  return [...publishArguments, '--env', `${portForwardsVariable}=${forwardPairs.join(' ')}`]
}

export function containerRunArguments(
  project: ProjectSettings,
  context: ContainerRunContext,
): string[] {
  return [
    'run',
    '--detach',
    '--init',
    ...identityArguments(project),
    '--security-opt',
    'label=disable',
    ...sharedCacheArguments(),
    ...userNamespaceArguments(context),
    ...hostMountArguments(context),
    ...moduleArguments(project, context),
    ...portArguments(project),
    imageName(project.name),
  ]
}

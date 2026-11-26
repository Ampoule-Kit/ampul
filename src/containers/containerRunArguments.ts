import type { ProjectSettings } from '../projects/ProjectSettings.ts'
import { formatPortRange, portForwards, portsInRange } from '../projects/ports.ts'
import { type HostMount, volumeArgument } from './hostConfigMounts.ts'
import {
  containerHome,
  containerName,
  imageName,
  innerEngineSocket,
  innerEngineVolumeName,
  projectLabel,
  sharedCacheVolume,
} from './naming.ts'

const innerContainerEngineModule = 'container-engine'
const innerEngineStorage = '/var/lib/containers'
const portForwardsVariable = 'AMPUL_PORT_FORWARDS'

export interface ContainerRunContext {
  isRootlessPodman: boolean
  hostMounts: HostMount[]
}

export function usesInnerContainerEngine(project: ProjectSettings): boolean {
  return project.modules.includes(innerContainerEngineModule)
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

function innerEngineArguments(project: ProjectSettings): string[] {
  if (!usesInnerContainerEngine(project)) return []
  const socketAddress = `unix://${innerEngineSocket}`
  return [
    '--privileged',
    '--volume',
    `${innerEngineVolumeName(project.name)}:${innerEngineStorage}`,
    '--env',
    `DOCKER_HOST=${socketAddress}`,
    '--env',
    `CONTAINER_HOST=${socketAddress}`,
    '--env',
    `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=${innerEngineSocket}`,
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
    ...innerEngineArguments(project),
    ...portArguments(project),
    imageName(project.name),
  ]
}

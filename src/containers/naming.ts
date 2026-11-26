import { preferences } from '../system/preferences.ts'

export const projectLabel = 'devenv.project'
export const cacheLabel = 'devenv.cache'
export const sharedCacheVolume = 'devenv-cache'
export const innerEngineSocket = '/run/podman/podman.sock'

const resourcePrefix = 'devenv-'

export function containerName(projectName: string): string {
  return resourcePrefix + projectName
}

export function imageName(projectName: string): string {
  return resourcePrefix + projectName
}

export function innerEngineVolumeName(projectName: string): string {
  return `${resourcePrefix}${projectName}-engine`
}

export function projectNameFromContainerName(name: string): string | undefined {
  return name.startsWith(resourcePrefix) ? name.slice(resourcePrefix.length) : undefined
}

export function containerUser(): string {
  return preferences().containerUser
}

export function containerHome(): string {
  return `/home/${containerUser()}`
}

export function containerProjectDirectory(): string {
  return `${containerHome()}/Project`
}

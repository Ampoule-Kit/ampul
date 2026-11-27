import { preferences } from '../system/preferences.ts'

export const projectLabel = 'ampul.project'
export const cacheLabel = 'ampul.cache'
export const sharedCacheVolume = 'ampul-cache'
export const innerEngineSocket = '/run/podman/podman.sock'

const resourcePrefix = 'ampul-'

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

export function containerCodeDirectory(): string {
  return `${containerHome()}/home`
}

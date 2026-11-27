import path from 'node:path'
import { displayPath } from '../system/platform.ts'
import type { CodeSource } from './ProjectSettings.ts'

export function repositoryFolderName(url: string): string {
  const withoutTrailingSlash = url.replace(/\/+$/, '')
  const lastSegment = withoutTrailingSlash.split('/').pop() ?? ''
  const afterHostSeparator = lastSegment.split(':').pop() ?? ''
  return afterHostSeparator.replace(/\.git$/, '')
}

export function repositoryUrlProblem(url: string, otherRepositories: string[]): string | undefined {
  const folderName = repositoryFolderName(url)
  if (/\s/.test(url) || !folderName) return `'${url}' does not look like a repository URL.`
  const clashingRepository = otherRepositories.find(
    (other) => repositoryFolderName(other) === folderName,
  )
  if (clashingRepository) {
    return `${clashingRepository} already clones into ~/home/${folderName}.`
  }
  return undefined
}

export function mountedFolderProblem(folder: string, otherFolders: string[]): string | undefined {
  const folderName = path.basename(folder)
  if (!folderName) return `${folder} has no folder name to mount it under.`
  const clashingFolder = otherFolders.find((other) => path.basename(other) === folderName)
  if (clashingFolder) {
    return `${displayPath(clashingFolder)} is already mounted at ~/home/${folderName}.`
  }
  return undefined
}

export function codeSourceFolderNames(codeSource: CodeSource): string[] {
  if (codeSource.kind === 'repositories') return codeSource.repositories.map(repositoryFolderName)
  if (codeSource.kind === 'folders')
    return codeSource.folders.map((folder) => path.basename(folder))
  return []
}

export function describeCodeSource(codeSource: CodeSource): string {
  if (codeSource.kind === 'repositories') {
    const names = codeSource.repositories.map(repositoryFolderName).join(', ')
    return codeSource.repositories.length === 1 ? `clone of ${names}` : `clones of ${names}`
  }
  if (codeSource.kind === 'folders') {
    const folders = codeSource.folders.map(displayPath).join(', ')
    return codeSource.folders.length === 1 ? `mount of ${folders}` : `mounts of ${folders}`
  }
  return 'pass-through of your home folder'
}

export function suggestedProjectName(codeSource: CodeSource): string {
  return codeSourceFolderNames(codeSource)[0] ?? ''
}

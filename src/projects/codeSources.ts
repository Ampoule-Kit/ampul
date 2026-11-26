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
    return `${clashingRepository} already clones into ~/Project/${folderName}.`
  }
  return undefined
}

export function codeSourceFolderNames(codeSource: CodeSource): string[] {
  if (codeSource.kind === 'repositories') return codeSource.repositories.map(repositoryFolderName)
  return [path.basename(codeSource.folder)]
}

export function describeCodeSource(codeSource: CodeSource): string {
  if (codeSource.kind === 'repositories') {
    const count = codeSource.repositories.length
    const names = codeSource.repositories.map(repositoryFolderName).join(', ')
    return count === 1 ? `clone of ${names}` : `clones of ${names}`
  }
  const scope = codeSource.onlyGitFiles ? 'git files of' : 'copy of'
  return `${scope} ${displayPath(codeSource.folder)}`
}

export function suggestedProjectName(codeSource: CodeSource): string {
  return codeSourceFolderNames(codeSource)[0] ?? ''
}

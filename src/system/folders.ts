import fs from 'node:fs'
import path from 'node:path'
import { expandHomeDirectory } from './platform.ts'

export function resolveFolder(enteredPath: string): string | undefined {
  const absolute = path.resolve(expandHomeDirectory(enteredPath.trim() || '.'))
  try {
    return fs.statSync(absolute).isDirectory() ? fs.realpathSync(absolute) : undefined
  } catch {
    return undefined
  }
}

export function isGitRepositoryRoot(folder: string): boolean {
  return fs.existsSync(path.join(folder, '.git'))
}

function splitForCompletion(enteredPath: string): { parent: string; partialName: string } {
  const endsWithSeparator = /[\\/]$/.test(enteredPath)
  if (endsWithSeparator || enteredPath === '~') {
    return { parent: enteredPath === '~' ? '~/' : enteredPath, partialName: '' }
  }
  const lastSeparator = Math.max(enteredPath.lastIndexOf('/'), enteredPath.lastIndexOf('\\'))
  return {
    parent: enteredPath.slice(0, lastSeparator + 1),
    partialName: enteredPath.slice(lastSeparator + 1),
  }
}

export function matchingSubfolders(enteredPath: string): string[] {
  const { parent, partialName } = splitForCompletion(enteredPath)
  const parentFolder = path.resolve(expandHomeDirectory(parent || '.'))
  try {
    return fs
      .readdirSync(parentFolder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name)
      .filter((name) => name.startsWith(partialName))
      .filter((name) => partialName.startsWith('.') || !name.startsWith('.'))
      .toSorted()
  } catch {
    return []
  }
}

function longestCommonPrefix(names: string[]): string {
  return names.reduce((prefix, name) => {
    let length = 0
    while (length < prefix.length && prefix[length] === name[length]) length++
    return prefix.slice(0, length)
  })
}

export function completeFolderPath(enteredPath: string): string {
  const matches = matchingSubfolders(enteredPath)
  if (matches.length === 0) return enteredPath
  const { parent } = splitForCompletion(enteredPath)
  if (matches.length === 1) return `${parent}${matches[0]}/`
  return parent + longestCommonPrefix(matches)
}

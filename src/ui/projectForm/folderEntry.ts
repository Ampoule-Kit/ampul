import { mountedFolderProblem } from '../../projects/codeSources.ts'
import { resolveFolder } from '../../system/folders.ts'
import type { ListEntryOutcome } from './listEntryOutcome.ts'

export function evaluateFolderEntry(
  enteredPath: string,
  addedFolders: string[],
): ListEntryOutcome<string> {
  const trimmedPath = enteredPath.trim()
  if (!trimmedPath) {
    return addedFolders.length > 0
      ? { kind: 'finish' }
      : { kind: 'problem', message: 'Enter at least one folder.' }
  }
  const folder = resolveFolder(trimmedPath)
  if (folder === undefined) return { kind: 'problem', message: `'${trimmedPath}' is not a folder.` }
  const problem = mountedFolderProblem(folder, addedFolders)
  if (problem) return { kind: 'problem', message: problem }
  return { kind: 'add', items: [folder] }
}

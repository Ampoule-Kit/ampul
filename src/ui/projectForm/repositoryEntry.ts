import { repositoryUrlProblem } from '../../projects/codeSources.ts'
import type { ListEntryOutcome } from './listEntryOutcome.ts'

export function evaluateRepositoryEntry(
  enteredUrl: string,
  addedRepositories: string[],
): ListEntryOutcome<string> {
  const url = enteredUrl.trim()
  if (!url) {
    return addedRepositories.length > 0
      ? { kind: 'finish' }
      : { kind: 'problem', message: 'Enter at least one repository URL.' }
  }
  const problem = repositoryUrlProblem(url, addedRepositories)
  if (problem) return { kind: 'problem', message: problem }
  return { kind: 'add', items: [url] }
}

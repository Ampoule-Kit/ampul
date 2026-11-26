import path from 'node:path'
import { Text } from 'ink'
import {
  completeFolderPath,
  isGitRepositoryRoot,
  matchingSubfolders,
  resolveFolder,
} from '../../system/folders.ts'
import { displayPath } from '../../system/platform.ts'
import { Question } from '../components/Question.tsx'
import { TextPrompt } from '../components/TextPrompt.tsx'
import type { StepControls } from '../components/Wizard.tsx'
import { colors, symbols } from '../theme.ts'
import type { ProjectDraft } from './ProjectDraft.ts'

const shownMatches = 6

function FolderPreview({ enteredPath }: { enteredPath: string }) {
  const folder = resolveFolder(enteredPath)
  if (folder) {
    return (
      <Text color={colors.muted}>
        <Text color={colors.success}>{symbols.success}</Text> {displayPath(folder)}
        {isGitRepositoryRoot(folder) ? ' · git repository' : ''}
        {'  '}
        {symbols.arrow} ~/Project/{path.basename(folder)}
      </Text>
    )
  }
  const matches = matchingSubfolders(enteredPath)
  if (matches.length === 0) return <Text color={colors.muted}>No folder by that name yet</Text>
  const more = matches.length > shownMatches ? `  +${matches.length - shownMatches} more` : ''
  return (
    <Text color={colors.muted}>
      {matches.slice(0, shownMatches).join('/  ')}/{more}
    </Text>
  )
}

export function FolderStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  return (
    <Question
      title="Which folder should be copied?"
      explanation="It is copied into ~/Project/<folder name>. Tab completes folder names."
    >
      <TextPrompt
        initialValue={displayPath(draft.folder || process.cwd())}
        validate={(value) => (resolveFolder(value) ? undefined : `'${value}' is not a folder.`)}
        complete={completeFolderPath}
        preview={(value) => <FolderPreview enteredPath={value} />}
        onSubmit={(value) => {
          const folder = resolveFolder(value)
          if (folder === undefined) return
          submit({ folder, onlyGitFiles: isGitRepositoryRoot(folder) && draft.onlyGitFiles })
        }}
        onCancel={back}
      />
    </Question>
  )
}

export function describeFolder(draft: ProjectDraft): string {
  return displayPath(draft.folder)
}

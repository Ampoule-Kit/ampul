import path from 'node:path'
import { Box, Text } from 'ink'
import { useState } from 'react'
import { folderSharingWarning } from '../../containers/folderSharing.ts'
import {
  completeFolderPath,
  isGitRepositoryRoot,
  matchingSubfolders,
  resolveFolder,
} from '../../system/folders.ts'
import { displayPath } from '../../system/platform.ts'
import { KeyHints } from '../components/KeyHints.tsx'
import { Question } from '../components/Question.tsx'
import { TextField } from '../components/TextField.tsx'
import type { StepControls } from '../components/Wizard.tsx'
import { colors, symbols } from '../theme.ts'
import { evaluateFolderEntry } from './folderEntry.ts'
import type { ProjectDraft } from './ProjectDraft.ts'

const shownMatches = 6

function MountedFolder({ folder }: { folder: string }) {
  const sharingWarning = folderSharingWarning(folder)
  return (
    <Box flexDirection="column">
      <Text>
        <Text color={colors.success}>{symbols.success}</Text> {displayPath(folder)}
        <Text color={colors.muted}>
          {isGitRepositoryRoot(folder) ? ' · git repository' : ''}
          {'  '}
          {symbols.arrow} ~/home/{path.basename(folder)}
        </Text>
      </Text>
      {sharingWarning && (
        <Text color={colors.warning}>
          {'  '}
          {symbols.warning} {sharingWarning}
        </Text>
      )}
    </Box>
  )
}

function MatchingFolders({ enteredPath }: { enteredPath: string }) {
  if (!enteredPath.trim() || resolveFolder(enteredPath)) return null
  const matches = matchingSubfolders(enteredPath)
  if (matches.length === 0) return <Text color={colors.muted}>No folder by that name yet</Text>
  const more = matches.length > shownMatches ? `  +${matches.length - shownMatches} more` : ''
  return (
    <Text color={colors.muted}>
      {matches.slice(0, shownMatches).join('/  ')}/{more}
    </Text>
  )
}

export function FoldersStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  const [folders, setFolders] = useState(draft.folders)
  const [enteredPath, setEnteredPath] = useState(
    draft.folders.length === 0 ? displayPath(process.cwd()) : '',
  )
  const [problem, setProblem] = useState<string>()

  const add = (submittedPath: string) => {
    const outcome = evaluateFolderEntry(submittedPath, folders)
    switch (outcome.kind) {
      case 'finish':
        submit({ folders })
        break
      case 'problem':
        setProblem(outcome.message)
        break
      case 'nothing':
        break
      case 'add':
        setFolders([...folders, ...outcome.items])
        setEnteredPath('')
        setProblem(undefined)
        break
    }
  }

  return (
    <Question
      title="Which folders should be mounted?"
      explanation="Each folder is mounted at ~/home/<folder name>, so changes on either side show up on both. Press enter to add a folder, and enter on an empty line when the list is complete."
    >
      {folders.map((folder) => (
        <MountedFolder key={folder} folder={folder} />
      ))}
      <Box>
        <Text color={colors.accent}>{symbols.prompt} </Text>
        <TextField
          value={enteredPath}
          onChange={(value) => {
            setEnteredPath(value)
            setProblem(undefined)
          }}
          onSubmit={add}
          onCancel={back}
          onTab={completeFolderPath}
          onBackspaceWhenEmpty={() => setFolders(folders.slice(0, -1))}
          placeholder={folders.length === 0 ? '~/code/api' : 'another folder, or enter to continue'}
        />
      </Box>
      {problem ? (
        <Text color={colors.danger}>
          {symbols.failure} {problem}
        </Text>
      ) : (
        <MatchingFolders enteredPath={enteredPath} />
      )}
      <KeyHints
        hints={[
          ['enter', folders.length > 0 && !enteredPath ? 'continue' : 'add'],
          ['tab', 'complete'],
          ['backspace', 'remove last'],
          ['esc', 'back'],
        ]}
      />
    </Question>
  )
}

export function describeFolders(draft: ProjectDraft): string {
  return draft.folders.map(displayPath).join(', ')
}

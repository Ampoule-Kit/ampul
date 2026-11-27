import { Box, Text } from 'ink'
import { useState } from 'react'
import { repositoryFolderName } from '../../projects/codeSources.ts'
import { KeyHints } from '../components/KeyHints.tsx'
import { Question } from '../components/Question.tsx'
import { TextField } from '../components/TextField.tsx'
import type { StepControls } from '../components/Wizard.tsx'
import { colors, symbols } from '../theme.ts'
import type { ProjectDraft } from './ProjectDraft.ts'
import { evaluateRepositoryEntry } from './repositoryEntry.ts'

export function RepositoriesStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  const [repositories, setRepositories] = useState(draft.repositories)
  const [url, setUrl] = useState('')
  const [problem, setProblem] = useState<string>()

  const add = (enteredUrl: string) => {
    const outcome = evaluateRepositoryEntry(enteredUrl, repositories)
    switch (outcome.kind) {
      case 'finish':
        submit({ repositories })
        break
      case 'problem':
        setProblem(outcome.message)
        break
      case 'nothing':
        break
      case 'add':
        setRepositories([...repositories, ...outcome.items])
        setUrl('')
        setProblem(undefined)
        break
    }
  }

  return (
    <Question
      title="Which repositories?"
      explanation="Paste a URL and press enter to add it. Press enter on an empty line when the list is complete."
    >
      {repositories.map((repository) => (
        <Text key={repository}>
          <Text color={colors.success}>{symbols.success}</Text> {repository}
          <Text color={colors.muted}>
            {'  '}
            {symbols.arrow} ~/work/{repositoryFolderName(repository)}
          </Text>
        </Text>
      ))}
      <Box>
        <Text color={colors.accent}>{symbols.prompt} </Text>
        <TextField
          value={url}
          onChange={(value) => {
            setUrl(value)
            setProblem(undefined)
          }}
          onSubmit={add}
          onCancel={back}
          onBackspaceWhenEmpty={() => setRepositories(repositories.slice(0, -1))}
          placeholder={
            repositories.length === 0
              ? 'git@github.com:you/project.git'
              : 'another URL, or enter to continue'
          }
        />
      </Box>
      {problem && (
        <Text color={colors.danger}>
          {symbols.failure} {problem}
        </Text>
      )}
      <KeyHints
        hints={[
          ['enter', repositories.length > 0 && !url ? 'continue' : 'add'],
          ['backspace', 'remove last'],
          ['esc', 'back'],
        ]}
      />
    </Question>
  )
}

export function describeRepositories(draft: ProjectDraft): string {
  return draft.repositories.map(repositoryFolderName).join(', ')
}

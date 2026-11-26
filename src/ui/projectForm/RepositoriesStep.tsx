import { Box, Text } from 'ink'
import { useState } from 'react'
import { repositoryFolderName, repositoryUrlProblem } from '../../projects/codeSources.js'
import { KeyHints } from '../components/KeyHints.js'
import { Question } from '../components/Question.js'
import { TextField } from '../components/TextField.js'
import type { StepControls } from '../components/Wizard.js'
import { colors, symbols } from '../theme.js'
import type { ProjectDraft } from './ProjectDraft.js'

export function RepositoriesStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  const [repositories, setRepositories] = useState(draft.repositories)
  const [url, setUrl] = useState('')
  const [problem, setProblem] = useState<string>()

  const add = (enteredUrl: string) => {
    const trimmed = enteredUrl.trim()
    if (!trimmed) {
      if (repositories.length === 0) return setProblem('Enter at least one repository URL.')
      return submit({ repositories })
    }
    const urlProblem = repositoryUrlProblem(trimmed, repositories)
    if (urlProblem) return setProblem(urlProblem)
    setRepositories([...repositories, trimmed])
    setUrl('')
    setProblem(undefined)
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
            {symbols.arrow} ~/Project/{repositoryFolderName(repository)}
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

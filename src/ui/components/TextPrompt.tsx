import { Box, Text } from 'ink'
import { useState, type ReactNode } from 'react'
import { colors, symbols } from '../theme.js'
import { KeyHints, type KeyHint } from './KeyHints.js'
import { TextField } from './TextField.js'

interface TextPromptProps {
  initialValue?: string
  placeholder?: string
  validate?: (value: string) => string | undefined
  preview?: (value: string) => ReactNode
  complete?: (value: string) => string
  onSubmit: (value: string) => void
  onCancel?: () => void
  extraHints?: KeyHint[]
}

export function TextPrompt({
  initialValue = '',
  placeholder,
  validate,
  preview,
  complete,
  onSubmit,
  onCancel,
  extraHints = [],
}: TextPromptProps) {
  const [value, setValue] = useState(initialValue)
  const [submittedProblem, setSubmittedProblem] = useState<string>()
  const liveProblem = submittedProblem ? validate?.(value) : undefined

  const submit = (submitted: string) => {
    const problem = validate?.(submitted.trim())
    if (problem) return setSubmittedProblem(problem)
    onSubmit(submitted.trim())
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={colors.accent}>{symbols.prompt} </Text>
        <TextField
          value={value}
          onChange={setValue}
          onSubmit={submit}
          onCancel={onCancel}
          onTab={complete}
          placeholder={placeholder}
        />
      </Box>
      {liveProblem && (
        <Text color={colors.danger}>
          {symbols.failure} {liveProblem}
        </Text>
      )}
      {!liveProblem && preview?.(value)}
      <KeyHints
        hints={[
          ['enter', 'continue'],
          ...(complete ? ([['tab', 'complete']] as KeyHint[]) : []),
          ...extraHints,
          ...(onCancel ? ([['esc', 'back']] as KeyHint[]) : []),
        ]}
      />
    </Box>
  )
}

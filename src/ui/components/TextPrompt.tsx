import { Box, Text } from 'ink'
import { type ReactNode, useState } from 'react'
import { colors, symbols } from '../theme.ts'
import { hintWhen, type KeyHint, KeyHints, noExtraHints } from './KeyHints.tsx'
import { TextField } from './TextField.tsx'

interface TextPromptProps {
  initialValue?: string
  placeholder?: string | undefined
  validate?: ((value: string) => string | undefined) | undefined
  preview?: ((value: string) => ReactNode) | undefined
  complete?: ((value: string) => string) | undefined
  onSubmit: (value: string) => void
  onCancel?: (() => void) | undefined
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
  extraHints = noExtraHints,
}: TextPromptProps) {
  const [value, setValue] = useState(initialValue)
  const [submittedProblem, setSubmittedProblem] = useState<string>()
  const liveProblem = submittedProblem ? validate?.(value) : undefined

  const submit = (submitted: string) => {
    const trimmed = submitted.trim()
    const problem = validate?.(trimmed)
    if (problem) setSubmittedProblem(problem)
    else onSubmit(trimmed)
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
          ...hintWhen(complete !== undefined, ['tab', 'complete']),
          ...extraHints,
          ...hintWhen(onCancel !== undefined, ['esc', 'back']),
        ]}
      />
    </Box>
  )
}

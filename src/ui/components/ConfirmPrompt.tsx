import { Box, Text, useInput } from 'ink'
import { useState } from 'react'
import { colors } from '../theme.ts'
import { KeyHints } from './KeyHints.tsx'

interface ConfirmPromptProps {
  yesLabel?: string
  noLabel?: string
  defaultAnswer?: boolean
  dangerous?: boolean
  onAnswer: (answer: boolean) => void
}

export function ConfirmPrompt({
  yesLabel = 'Yes',
  noLabel = 'No',
  defaultAnswer = false,
  dangerous = false,
  onAnswer,
}: ConfirmPromptProps) {
  const [answer, setAnswer] = useState(defaultAnswer)

  useInput((input, key) => {
    if (key.leftArrow || key.rightArrow || key.tab || key.upArrow || key.downArrow) {
      setAnswer((current) => !current)
    } else if (input.toLowerCase() === 'y') {
      onAnswer(true)
    } else if (input.toLowerCase() === 'n' || key.escape) {
      onAnswer(false)
    } else if (key.return) {
      onAnswer(answer)
    }
  })

  const yesColor = dangerous ? colors.danger : colors.accent
  return (
    <Box flexDirection="column">
      <Box gap={2}>
        <Text inverse={answer} color={answer ? yesColor : colors.muted} bold={answer}>
          {` ${yesLabel} `}
        </Text>
        <Text inverse={!answer} color={answer ? colors.muted : colors.accent} bold={!answer}>
          {` ${noLabel} `}
        </Text>
      </Box>
      <KeyHints
        hints={[
          ['←→', 'switch'],
          ['y/n', 'answer'],
          ['enter', 'confirm'],
        ]}
      />
    </Box>
  )
}

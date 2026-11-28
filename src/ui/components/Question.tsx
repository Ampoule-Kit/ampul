import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import { colors, symbols } from '../theme.ts'

interface QuestionProps {
  title: string
  explanation?: ReactNode | undefined
  children: ReactNode
}

export function Question({ title, explanation, children }: QuestionProps) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        <Text color={colors.accent}>{symbols.prompt}</Text> <Text bold>{title}</Text>
      </Text>
      {explanation !== undefined && (
        <Box marginLeft={2}>
          <Text color={colors.muted}>{explanation}</Text>
        </Box>
      )}
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        {children}
      </Box>
    </Box>
  )
}

interface AnsweredQuestionProps {
  title: string
  answer: string
  titleWidth?: number | undefined
}

export function AnsweredQuestion({ title, answer, titleWidth = 0 }: AnsweredQuestionProps) {
  return (
    <Box>
      <Box flexShrink={0}>
        <Text>
          <Text color={colors.success}>{symbols.success}</Text>{' '}
          <Text color={colors.muted}>{title.padEnd(titleWidth)}</Text>{' '}
        </Text>
      </Box>
      <Text>{answer}</Text>
    </Box>
  )
}

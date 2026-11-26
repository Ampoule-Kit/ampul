import { Box, Text } from 'ink'
import type { Problem } from '../../problems/Problem.js'
import { displayPath } from '../../system/platform.js'
import { colors, symbols } from '../theme.js'

const outputLinesShown = 15

export function ProblemView({ problem }: { problem: Problem }) {
  const outputTail = problem.outputTail.filter((line) => line.trim()).slice(-outputLinesShown)
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.danger} bold>
        {symbols.failure} {problem.title}
      </Text>
      {problem.explanation && (
        <Box marginLeft={2}>
          <Text>{problem.explanation}</Text>
        </Box>
      )}
      {outputTail.length > 0 && (
        <Box
          flexDirection="column"
          marginLeft={2}
          marginTop={1}
          borderStyle="single"
          borderColor={colors.muted}
          borderTop={false}
          borderRight={false}
          borderBottom={false}
          paddingLeft={1}
        >
          {outputTail.map((line, index) => (
            <Text key={index} color={colors.muted} wrap="truncate-end">
              {line}
            </Text>
          ))}
        </Box>
      )}
      {problem.logFile && (
        <Box marginLeft={2} marginTop={1}>
          <Text color={colors.muted}>
            Full log: <Text color={colors.emphasis}>{displayPath(problem.logFile)}</Text>
          </Text>
        </Box>
      )}
      {problem.fixes.length > 0 && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          <Text bold>How to fix it</Text>
          {problem.fixes.map((fix) => (
            <Box key={fix.description + fix.command} flexDirection="column" marginLeft={1}>
              <Text>
                <Text color={colors.accent}>{symbols.arrow}</Text> {fix.description}
              </Text>
              {fix.command && (
                <Box marginLeft={2}>
                  <Text color={colors.accent}>$ {fix.command}</Text>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

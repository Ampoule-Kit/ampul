import { Box, Text } from 'ink'
import { ampulVersion } from '../../version.ts'
import { colors } from '../theme.ts'
import { useTerminalSize } from './useListHeight.ts'

interface HeaderProps {
  title: string
  subtitle?: string
}

const widestRule = 80

export function Header({ title, subtitle }: HeaderProps) {
  const ruleWidth = Math.min(widestRule, useTerminalSize().columns ?? widestRule)
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        <Text backgroundColor={colors.brand} color="black" bold>
          {' ampul '}
        </Text>{' '}
        <Text bold>{title}</Text> <Text color={colors.muted}>v{ampulVersion}</Text>
      </Text>
      {subtitle && <Text color={colors.muted}>{subtitle}</Text>}
      <Text color={colors.muted} dimColor>
        {'─'.repeat(ruleWidth)}
      </Text>
    </Box>
  )
}

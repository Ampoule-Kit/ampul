import { Box, Text } from 'ink'
import { ampulVersion } from '../../version.ts'
import { colors } from '../theme.ts'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        <Text backgroundColor={colors.brand} color="black" bold>
          {' ampul '}
        </Text>{' '}
        <Text bold>{title}</Text> <Text color={colors.muted}>v{ampulVersion}</Text>
      </Text>
      {subtitle && <Text color={colors.muted}>{subtitle}</Text>}
    </Box>
  )
}

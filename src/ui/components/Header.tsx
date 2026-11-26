import { Box, Text } from 'ink'
import { devenvVersion } from '../../version.ts'
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
          {' devenv '}
        </Text>{' '}
        <Text bold>{title}</Text> <Text color={colors.muted}>v{devenvVersion}</Text>
      </Text>
      {subtitle && <Text color={colors.muted}>{subtitle}</Text>}
    </Box>
  )
}

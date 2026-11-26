import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import { colors } from '../theme.ts'

export function Description({
  children,
  color = colors.muted,
}: {
  children: ReactNode
  color?: string
}) {
  return (
    <Box
      borderStyle="bold"
      borderColor={color}
      borderTop={false}
      borderRight={false}
      borderBottom={false}
      paddingLeft={1}
      marginTop={1}
    >
      <Text color={color}>{children}</Text>
    </Box>
  )
}

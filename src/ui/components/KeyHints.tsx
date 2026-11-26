import { Box, Text } from 'ink'
import { Fragment } from 'react'
import { colors } from '../theme.js'

export type KeyHint = [keys: string, action: string]

export function KeyHints({ hints }: { hints: KeyHint[] }) {
  return (
    <Box marginTop={1}>
      <Text color={colors.muted}>
        {hints.map(([keys, action], index) => (
          <Fragment key={keys}>
            {index > 0 && '  ·  '}
            <Text bold>{keys}</Text> {action}
          </Fragment>
        ))}
      </Text>
    </Box>
  )
}

import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import { colors, symbols } from '../theme.ts'

type CalloutTone = 'info' | 'warning' | 'danger' | 'success'

const toneStyles: Record<CalloutTone, { color: string; symbol: string }> = {
  info: { color: colors.accent, symbol: symbols.info },
  warning: { color: colors.warning, symbol: symbols.warning },
  danger: { color: colors.danger, symbol: symbols.warning },
  success: { color: colors.success, symbol: symbols.success },
}

interface CalloutProps {
  tone: CalloutTone
  title: string
  children?: ReactNode
}

export function Callout({ tone, title, children }: CalloutProps) {
  const { color, symbol } = toneStyles[tone]
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} marginTop={1}>
      <Text color={color} bold>
        {symbol} {title}
      </Text>
      {children !== undefined && <Box flexDirection="column">{children}</Box>}
    </Box>
  )
}

export function Bullet({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <Text>
      <Text color={color ?? colors.muted}>{symbols.bullet}</Text> {children}
    </Text>
  )
}

import { Text, useAnimation } from 'ink'
import { colors, spinnerFrames, spinnerIntervalMilliseconds } from '../theme.js'

export function Spinner({ color = colors.accent }: { color?: string }) {
  const { frame } = useAnimation({ interval: spinnerIntervalMilliseconds })
  return <Text color={color}>{spinnerFrames[frame % spinnerFrames.length]}</Text>
}

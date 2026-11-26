import { type ContainerState, containerStateLabels } from '../containers/containerState.ts'
import { colors, symbols, type ThemeColor } from './theme.ts'

export function containerStateMarker(state: ContainerState | undefined): string {
  if (!state) return `${symbols.stopped} unknown`
  const symbol = state === 'running' ? symbols.running : symbols.stopped
  return `${symbol} ${containerStateLabels[state]}`
}

export function containerStateColor(state: ContainerState | undefined): ThemeColor {
  if (state === 'running') return colors.success
  if (state === 'missing') return colors.warning
  return colors.muted
}

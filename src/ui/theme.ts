export const colors = {
  brand: 'cyan',
  accent: 'cyan',
  success: 'green',
  warning: 'yellow',
  danger: 'red',
  muted: 'gray',
  emphasis: 'white',
} as const

export const symbols = {
  success: '✔',
  failure: '✖',
  warning: '▲',
  info: 'ℹ',
  pending: '○',
  pointer: '❯',
  selected: '◉',
  unselected: '◯',
  radioSelected: '◉',
  radioUnselected: '◯',
  arrow: '→',
  bullet: '•',
  ellipsis: '…',
  prompt: '›',
  running: '●',
  stopped: '○',
} as const

export const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
export const spinnerIntervalMilliseconds = 80

export type ThemeColor = (typeof colors)[keyof typeof colors]

export function colorOrTerminalDefault(color: ThemeColor | undefined): { color?: ThemeColor } {
  return color === undefined ? {} : { color }
}

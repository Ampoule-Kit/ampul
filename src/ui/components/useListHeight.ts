import { useStdout } from 'ink'

const fallbackTerminalRows = 30
const fewestRows = 6

// Lists use the rows the terminal has to spare, so a tall terminal shows more at once.
function sizeOf(stream: object, dimension: 'columns' | 'rows'): number | undefined {
  const value: unknown = Reflect.get(stream, dimension)
  return typeof value === 'number' && value > 0 ? value : undefined
}

export function useTerminalSize(): { columns: number | undefined; rows: number | undefined } {
  const { stdout } = useStdout()
  return { columns: sizeOf(stdout, 'columns'), rows: sizeOf(stdout, 'rows') }
}

export function useListHeight(reservedRows: number, mostRows: number): number {
  const terminalRows = useTerminalSize().rows ?? fallbackTerminalRows
  return Math.max(fewestRows, Math.min(mostRows, terminalRows - reservedRows))
}

export function labelColumnWidth(labels: readonly string[]): number {
  return Math.max(0, ...labels.map((label) => label.length)) + 2
}

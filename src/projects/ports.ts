export interface PortRange {
  first: number
  last: number
}

function ascending(first: number, second: number): number {
  return first - second
}

export function portRanges(ports: number[]): PortRange[] {
  const ranges: PortRange[] = []
  for (const port of [...new Set(ports)].toSorted(ascending)) {
    const currentRange = ranges.at(-1)
    if (currentRange && port === currentRange.last + 1) currentRange.last = port
    else ranges.push({ first: port, last: port })
  }
  return ranges
}

export function formatPortRange(range: PortRange): string {
  return range.first === range.last ? String(range.first) : `${range.first}-${range.last}`
}

export function formatPortList(ports: number[]): string {
  return portRanges(ports).map(formatPortRange).join(', ')
}

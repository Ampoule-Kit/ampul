export interface PortRange {
  first: number
  last: number
}

export interface PortForward {
  host: PortRange
  container: PortRange
}

export type PortEntryResult = { ranges: PortRange[]; problem?: undefined } | { problem: string }

const lowestPort = 1
const highestPort = 65535
const privilegedPortLimit = 1024
export const maximumForwardedPorts = 100
const forwardingPorts: PortRange = { first: 61000, last: 61000 + maximumForwardedPorts - 1 }

const portEntryPattern = /^(\d+)(?:-(\d+))?$/

export function portsInRange(range: PortRange): number[] {
  return Array.from({ length: range.last - range.first + 1 }, (_, offset) => range.first + offset)
}

export function combinePorts(ranges: PortRange[]): number[] {
  return [...new Set(ranges.flatMap(portsInRange))].sort((a, b) => a - b)
}

export function portRanges(ports: number[]): PortRange[] {
  const ranges: PortRange[] = []
  for (const port of [...new Set(ports)].sort((a, b) => a - b)) {
    const current = ranges.at(-1)
    if (current && port === current.last + 1) current.last = port
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

function rangesOverlap(one: PortRange, other: PortRange): boolean {
  return one.first <= other.last && other.first <= one.last
}

function parsePortNumber(text: string): number | string {
  const port = Number(text)
  if (port < lowestPort || port > highestPort) {
    return `${text} is not a port. Ports go from ${lowestPort} to ${highestPort}.`
  }
  return port
}

function parseRange(entry: string): PortRange | string {
  const match = entry.match(portEntryPattern)
  if (!match) {
    return `'${entry}' is not a port or a range. Write a port like 8080 or a range like 3000-3009.`
  }
  const [, firstText = '', lastText = firstText] = match
  const first = parsePortNumber(firstText)
  if (typeof first === 'string') return first
  const last = parsePortNumber(lastText)
  if (typeof last === 'string') return last
  if (last < first) return `${entry} runs backwards. Write it as ${last}-${first}.`
  const range = { first, last }
  if (rangesOverlap(range, forwardingPorts)) {
    return `Ports ${formatPortRange(forwardingPorts)} are taken by devenv itself to forward ports into the container.`
  }
  return range
}

export function parsePortEntry(text: string, alreadyAdded: PortRange[]): PortEntryResult {
  const entries = text
    .replace(/\s*[-–]\s*/g, '-')
    .split(/[\s,]+/)
    .filter(Boolean)
  const ranges: PortRange[] = []
  for (const entry of entries) {
    const range = parseRange(entry)
    if (typeof range === 'string') return { problem: range }
    const overlapping = [...alreadyAdded, ...ranges].find((other) => rangesOverlap(range, other))
    if (overlapping) {
      const entered = formatPortRange(range)
      const existing = formatPortRange(overlapping)
      return {
        problem:
          entered === existing
            ? `${entered} is already in the list.`
            : `${entered} overlaps ${existing}, which is already in the list.`,
      }
    }
    ranges.push(range)
  }
  return { ranges }
}

export function tooManyPortsProblem(ports: number[]): string | undefined {
  if (ports.length <= maximumForwardedPorts) return undefined
  return `That is ${ports.length} ports, and devenv forwards at most ${maximumForwardedPorts}. Use smaller ranges.`
}

export function privilegedPorts(ports: number[]): number[] {
  return ports.filter((port) => port < privilegedPortLimit)
}

export function portForwards(ports: number[]): PortForward[] {
  let nextContainerPort = forwardingPorts.first
  return portRanges(ports).map((host) => {
    const container = {
      first: nextContainerPort,
      last: nextContainerPort + host.last - host.first,
    }
    nextContainerPort = container.last + 1
    return { host, container }
  })
}

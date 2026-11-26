const firstForwardedContainerPort = 61000
const highestPort = 65535

export type PortsParseResult = { ports: number[]; problem?: undefined } | { problem: string }

export function parsePorts(text: string): PortsParseResult {
  const entries = text.split(/[\s,]+/).filter(Boolean)
  const ports: number[] = []
  for (const entry of entries) {
    const port = Number(entry)
    if (!/^\d+$/.test(entry) || port < 1 || port > highestPort) {
      return { problem: `'${entry}' is not a port number (1–${highestPort}).` }
    }
    if (ports.includes(port)) return { problem: `Port ${port} is listed twice.` }
    ports.push(port)
  }
  if (firstForwardedContainerPort + ports.length - 1 > highestPort) {
    return { problem: 'Too many ports.' }
  }
  return { ports }
}

export function forwardedContainerPort(portIndex: number): number {
  return firstForwardedContainerPort + portIndex
}

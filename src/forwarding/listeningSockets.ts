export type TargetAddress = '127.0.0.1' | '::1'

export interface ListeningSocket {
  address: string
  port: number
}

const privilegedPortLimit = 1024
const hexPattern = /^[0-9A-F]+$/i
const ipv4HexLength = 8
const ipv6HexLength = 32
const bytesPerWord = 4

function bytesInHostOrder(hex: string): number[] {
  const bytes: number[] = []
  for (let wordStart = 0; wordStart < hex.length; wordStart += bytesPerWord * 2) {
    const word = hex.slice(wordStart, wordStart + bytesPerWord * 2)
    const wordBytes = word.match(/../g)?.map((pair) => Number.parseInt(pair, 16)) ?? []
    bytes.push(...wordBytes.toReversed())
  }
  return bytes
}

function ipv6Text(bytes: number[]): string {
  const isV4Mapped =
    bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff
  if (isV4Mapped) return bytes.slice(12).join('.')
  if (bytes.every((byte) => byte === 0)) return '::'
  if (bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1) return '::1'
  const groups: string[] = []
  for (let index = 0; index < bytes.length; index += 2) {
    groups.push((((bytes[index] ?? 0) << 8) | (bytes[index + 1] ?? 0)).toString(16))
  }
  return groups.join(':')
}

export function parseSocketAddress(entry: string): ListeningSocket | undefined {
  const [addressHex = '', portHex = ''] = entry.split(':')
  if (!hexPattern.test(addressHex) || !hexPattern.test(portHex)) return undefined
  const port = Number.parseInt(portHex, 16)
  if (addressHex.length === ipv4HexLength) {
    return { address: bytesInHostOrder(addressHex).join('.'), port }
  }
  if (addressHex.length === ipv6HexLength) {
    return { address: ipv6Text(bytesInHostOrder(addressHex)), port }
  }
  return undefined
}

export function parseListenerReport(line: string): ListeningSocket[] | undefined {
  const [keyword, ...entries] = line.trim().split(/\s+/)
  if (keyword !== 'listening') return undefined
  return entries.flatMap((entry) => parseSocketAddress(entry) ?? [])
}

function reachesIpv4Loopback(address: string): boolean {
  return address === '0.0.0.0' || address.startsWith('127.')
}

function reachesIpv6Loopback(address: string): boolean {
  return address === '::' || address === '::1'
}

export function forwardablePorts(
  sockets: ListeningSocket[],
  excludedPorts: ReadonlySet<number>,
): Map<number, TargetAddress> {
  const targets = new Map<number, TargetAddress>()
  for (const { address, port } of sockets) {
    if (port < privilegedPortLimit || excludedPorts.has(port)) continue
    if (reachesIpv4Loopback(address)) targets.set(port, '127.0.0.1')
    else if (reachesIpv6Loopback(address) && !targets.has(port)) targets.set(port, '::1')
  }
  return new Map([...targets].toSorted(([first], [second]) => first - second))
}

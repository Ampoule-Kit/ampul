import crypto from 'node:crypto'
import type { TargetAddress } from './listeningSockets.ts'

export const tunnelContainerPort = 61_000
export const tunnelTokenVariable = 'AMPUL_TUNNEL_TOKEN'
export const tunnelPortVariable = 'AMPUL_TUNNEL_PORT'
export const listenerWatchScript = '/opt/ampul/port-listeners.sh'

const tokenBytes = 24

export function newTunnelToken(): string {
  return crypto.randomBytes(tokenBytes).toString('hex')
}

export function tunnelHeader(token: string, port: number, address: TargetAddress): string {
  return `${token} ${port} ${address}\n`
}

export function tunnelPublishArgument(): string {
  return `127.0.0.1::${tunnelContainerPort}`
}

export function parsePublishedPort(portOutput: string): number | undefined {
  for (const line of portOutput.split('\n')) {
    const match = /^127\.0\.0\.1:(\d+)$/.exec(line.trim())
    if (match) return Number(match[1])
  }
  return undefined
}

export function tokenFromEnvironment(environmentLines: string): string | undefined {
  const prefix = `${tunnelTokenVariable}=`
  return environmentLines
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith(prefix))
    ?.slice(prefix.length)
}

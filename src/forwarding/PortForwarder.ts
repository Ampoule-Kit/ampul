import net from 'node:net'
import { errorCode } from '../system/errorCodes.ts'
import type { TargetAddress } from './listeningSockets.ts'
import { tunnelHeader } from './tunnel.ts'

export interface TunnelEndpoint {
  host: string
  port: number
  token: string
}

export interface ForwardingReport {
  forwarded: number[]
  unavailable: number[]
}

interface PortForwarderOptions {
  tunnel: TunnelEndpoint
  onChange: (report: ForwardingReport) => void
  log: (message: string) => void
}

interface Forward {
  target: TargetAddress
  servers: net.Server[]
}

const hostAddresses = { ipv4: '127.0.0.1', ipv6: '::1' }

function listen(port: number, host: string, onConnection: (socket: net.Socket) => void) {
  return new Promise<net.Server>((resolve, reject) => {
    const server = net.createServer({ allowHalfOpen: true, noDelay: true }, onConnection)
    server.once('error', reject)
    server.listen({ port, host, exclusive: true }, () => {
      server.off('error', reject)
      server.on('error', () => {})
      resolve(server)
    })
  })
}

function close(server: net.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}

function describeError(error: unknown): string {
  return errorCode(error) ?? String(error)
}

function ascendingKeys(map: ReadonlyMap<number, unknown>): number[] {
  return [...map.keys()].toSorted((first, second) => first - second)
}

export class PortForwarder {
  private readonly forwards = new Map<number, Forward>()
  private readonly unavailable = new Map<number, TargetAddress>()
  private readonly connections = new Set<net.Socket>()
  private wanted = new Map<number, TargetAddress>()
  private pending: Promise<void> = Promise.resolve()
  private lastReport = ''
  private readonly options: PortForwarderOptions

  constructor(options: PortForwarderOptions) {
    this.options = options
  }

  update(wanted: Map<number, TargetAddress>): Promise<void> {
    this.wanted = wanted
    return this.queue(() => this.apply())
  }

  retryUnavailable(): Promise<void> {
    if (this.unavailable.size === 0) return this.pending
    return this.queue(() => this.apply())
  }

  close(): Promise<void> {
    this.wanted = new Map()
    for (const socket of this.connections) socket.destroy()
    return this.queue(() => this.apply())
  }

  private queue(work: () => Promise<void>): Promise<void> {
    this.pending = this.pending.then(work, work)
    return this.pending
  }

  private async apply(): Promise<void> {
    for (const [port, forward] of this.forwards) {
      if (this.wanted.has(port)) continue
      this.forwards.delete(port)
      await Promise.all(forward.servers.map(close))
      this.options.log(`Stopped forwarding ${port}`)
    }
    for (const port of this.unavailable.keys()) {
      if (!this.wanted.has(port)) this.unavailable.delete(port)
    }
    for (const [port, target] of this.wanted) {
      const existing = this.forwards.get(port)
      if (existing) existing.target = target
      else await this.open(port, target)
    }
    this.report()
  }

  private async open(port: number, target: TargetAddress): Promise<void> {
    const forward: Forward = { target, servers: [] }
    const onConnection = (socket: net.Socket) => this.connect(socket, port, forward)
    try {
      forward.servers.push(await listen(port, hostAddresses.ipv4, onConnection))
    } catch (error) {
      if (!this.unavailable.has(port)) {
        this.options.log(`Cannot forward ${port}: ${describeError(error)} on this machine`)
      }
      this.unavailable.set(port, target)
      return
    }
    try {
      forward.servers.push(await listen(port, hostAddresses.ipv6, onConnection))
    } catch (error) {
      this.options.log(`Forwarding ${port} over IPv4 only: ${describeError(error)} on ::1`)
    }
    this.unavailable.delete(port)
    this.forwards.set(port, forward)
    this.options.log(`Forwarding ${port} to ${target} in the container`)
  }

  private connect(client: net.Socket, port: number, forward: Forward): void {
    const { tunnel } = this.options
    const upstream = net.connect({
      host: tunnel.host,
      port: tunnel.port,
      allowHalfOpen: true,
      noDelay: true,
    })
    this.connections.add(client)
    this.connections.add(upstream)
    upstream.write(tunnelHeader(tunnel.token, port, forward.target))
    client.pipe(upstream)
    upstream.pipe(client)
    const closeBoth = () => {
      client.destroy()
      upstream.destroy()
      this.connections.delete(client)
      this.connections.delete(upstream)
    }
    client.on('error', closeBoth).on('close', closeBoth)
    upstream.on('error', closeBoth).on('close', closeBoth)
  }

  private report(): void {
    const report = {
      forwarded: ascendingKeys(this.forwards),
      unavailable: ascendingKeys(this.unavailable),
    }
    const text = JSON.stringify(report)
    if (text === this.lastReport) return
    this.lastReport = text
    this.options.onChange(report)
  }
}

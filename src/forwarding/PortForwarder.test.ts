import assert from 'node:assert/strict'
import net from 'node:net'
import { afterEach, describe, it } from 'node:test'
import { type ForwardingReport, PortForwarder } from './PortForwarder.ts'

const token = 'secret'

function listenOnFreePort(onConnection: (socket: net.Socket) => void): Promise<net.Server> {
  return new Promise((resolve) => {
    const server = net.createServer(onConnection)
    server.listen({ port: 0, host: '127.0.0.1' }, () => {
      resolve(server)
    })
  })
}

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      resolve()
    })
  })
}

function portOf(server: net.Server): number {
  const address = server.address()
  assert.ok(address !== null && typeof address === 'object')
  return address.port
}

async function freePort(): Promise<number> {
  const server = await listenOnFreePort(() => {})
  const port = portOf(server)
  await closeServer(server)
  return port
}

function fakeTunnel(headers: string[]): Promise<net.Server> {
  return listenOnFreePort((socket) => {
    let received = ''
    const readHeader = (chunk: Buffer) => {
      received += chunk.toString('latin1')
      const newline = received.indexOf('\n')
      if (newline === -1) return
      socket.off('data', readHeader)
      headers.push(received.slice(0, newline))
      socket.pause()
      const rest = Buffer.from(received.slice(newline + 1), 'latin1')
      socket.write('echo:')
      if (rest.length > 0) socket.write(rest)
      socket.on('data', (data) => {
        socket.write(data)
      })
      socket.resume()
    }
    socket.on('data', readHeader)
  })
}

function exchange(port: number, message: string, expectedLength: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ port, host: '127.0.0.1' }, () => {
      socket.write(message)
    })
    let reply = ''
    socket.on('data', (data) => {
      reply += data.toString()
      if (reply.length >= expectedLength) {
        socket.destroy()
        resolve(reply)
      }
    })
    socket.on('error', reject)
  })
}

const cleanups: (() => Promise<unknown>)[] = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup()
})

async function startForwarder(headers: string[], reports: ForwardingReport[]) {
  const tunnel = await fakeTunnel(headers)
  cleanups.push(() => closeServer(tunnel))
  const forwarder = new PortForwarder({
    tunnel: { host: '127.0.0.1', port: portOf(tunnel), token },
    onChange: (report) => {
      reports.push(report)
    },
    log: () => {},
  })
  cleanups.push(() => forwarder.close())
  return forwarder
}

describe('PortForwarder', () => {
  it('sends each connection through the tunnel, naming the port first', async () => {
    const headers: string[] = []
    const reports: ForwardingReport[] = []
    const forwarder = await startForwarder(headers, reports)
    const port = await freePort()

    await forwarder.update(new Map([[port, '127.0.0.1']]))

    assert.equal(await exchange(port, 'hello', 'echo:hello'.length), 'echo:hello')
    assert.deepEqual(headers, [`${token} ${port} 127.0.0.1`])
    assert.deepEqual(reports.at(-1), { forwarded: [port], unavailable: [] })
  })

  it('stops forwarding a port once nothing listens on it in the container', async () => {
    const reports: ForwardingReport[] = []
    const forwarder = await startForwarder([], reports)
    const port = await freePort()

    await forwarder.update(new Map([[port, '127.0.0.1']]))
    await forwarder.update(new Map())

    assert.deepEqual(reports.at(-1), { forwarded: [], unavailable: [] })
    await assert.rejects(exchange(port, 'hello', 1), /ECONNREFUSED/)
  })

  it('reports a port taken on this machine, and forwards it once it is free', async () => {
    const reports: ForwardingReport[] = []
    const forwarder = await startForwarder([], reports)
    const taken = await listenOnFreePort(() => {})
    const port = portOf(taken)

    await forwarder.update(new Map([[port, '::1']]))
    assert.deepEqual(reports.at(-1), { forwarded: [], unavailable: [port] })

    await closeServer(taken)
    await forwarder.retryUnavailable()
    assert.deepEqual(reports.at(-1), { forwarded: [port], unavailable: [] })
  })
})

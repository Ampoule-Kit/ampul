import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { forwardablePorts, parseListenerReport, parseSocketAddress } from './listeningSockets.ts'

describe('parseSocketAddress', () => {
  it('reads IPv4 addresses from /proc/net/tcp', () => {
    assert.deepEqual(parseSocketAddress('0100007F:1F90'), { address: '127.0.0.1', port: 8080 })
    assert.deepEqual(parseSocketAddress('00000000:4331'), { address: '0.0.0.0', port: 17_201 })
  })

  it('reads IPv6 addresses from /proc/net/tcp6', () => {
    assert.deepEqual(parseSocketAddress('00000000000000000000000001000000:4321'), {
      address: '::1',
      port: 17_185,
    })
    assert.deepEqual(parseSocketAddress('00000000000000000000000000000000:1F90'), {
      address: '::',
      port: 8080,
    })
  })

  it('reads IPv4 addresses mapped into IPv6', () => {
    assert.deepEqual(parseSocketAddress('0000000000000000FFFF00000100007F:1F90'), {
      address: '127.0.0.1',
      port: 8080,
    })
  })

  it('ignores text that is not an address', () => {
    assert.equal(parseSocketAddress('local_address'), undefined)
    assert.equal(parseSocketAddress('0100:1F90'), undefined)
  })
})

describe('parseListenerReport', () => {
  it('reads every socket in a report line', () => {
    assert.deepEqual(parseListenerReport('listening 0100007F:1F90 00000000:0050 '), [
      { address: '127.0.0.1', port: 8080 },
      { address: '0.0.0.0', port: 80 },
    ])
  })

  it('reads a report with nothing listening', () => {
    assert.deepEqual(parseListenerReport('listening '), [])
  })

  it('ignores other lines', () => {
    assert.equal(parseListenerReport('socat[12]: E connect failed'), undefined)
  })
})

describe('forwardablePorts', () => {
  it('forwards ports on loopback or every address, over IPv4 when it can', () => {
    const ports = forwardablePorts(
      [
        { address: '::1', port: 17_199 },
        { address: '127.0.0.1', port: 17_199 },
        { address: '::', port: 5173 },
        { address: '0.0.0.0', port: 3000 },
      ],
      new Set(),
    )
    assert.deepEqual(
      [...ports],
      [
        [3000, '127.0.0.1'],
        [5173, '::1'],
        [17_199, '127.0.0.1'],
      ],
    )
  })

  it('leaves out ports below 1024, excluded ports and other addresses', () => {
    const ports = forwardablePorts(
      [
        { address: '0.0.0.0', port: 80 },
        { address: '0.0.0.0', port: 61_000 },
        { address: '172.17.0.2', port: 8080 },
        { address: '127.0.0.1', port: 9229 },
      ],
      new Set([61_000, 9229]),
    )
    assert.deepEqual([...ports], [])
  })
})

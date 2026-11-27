import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { newTunnelToken, parsePublishedPort, tokenFromEnvironment, tunnelHeader } from './tunnel.ts'

describe('tunnel', () => {
  it('names the target port and address on the first line', () => {
    assert.equal(tunnelHeader('abc', 17_199, '::1'), 'abc 17199 ::1\n')
  })

  it('makes a new random token every time', () => {
    assert.match(newTunnelToken(), /^[0-9a-f]{48}$/)
    assert.notEqual(newTunnelToken(), newTunnelToken())
  })

  it('reads the host port the engine picked for the tunnel', () => {
    assert.equal(parsePublishedPort('127.0.0.1:52011\n'), 52_011)
    assert.equal(parsePublishedPort('[::1]:52012\n127.0.0.1:52011\n'), 52_011)
    assert.equal(parsePublishedPort('Error: no public port 61000/tcp published\n'), undefined)
  })

  it('finds the token among the environment variables of the container', () => {
    const environment = 'PATH=/usr/bin\nAMPUL_TUNNEL_PORT=61000\nAMPUL_TUNNEL_TOKEN=abc=d\n\n'
    assert.equal(tokenFromEnvironment(environment), 'abc=d')
    assert.equal(tokenFromEnvironment('PATH=/usr/bin\n'), undefined)
  })
})

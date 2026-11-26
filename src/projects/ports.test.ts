import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  combinePorts,
  formatPortList,
  parsePortEntry,
  portForwards,
  portRanges,
  privilegedPorts,
  tooManyPortsProblem,
} from './ports.ts'

describe('parsePortEntry', () => {
  it('reads single ports, ranges and several entries at once', () => {
    assert.deepEqual(parsePortEntry('3000-3009 8000-8005, 9000', []), {
      ranges: [
        { first: 3000, last: 3009 },
        { first: 8000, last: 8005 },
        { first: 9000, last: 9000 },
      ],
    })
  })

  it('accepts spaces and an en dash around the range separator', () => {
    assert.deepEqual(parsePortEntry('3000 – 3009', []), { ranges: [{ first: 3000, last: 3009 }] })
  })

  it('explains a range that runs backwards', () => {
    assert.deepEqual(parsePortEntry('3009-3000', []), {
      problem: '3009-3000 runs backwards. Write it as 3000-3009.',
    })
  })

  it('rejects ports outside 1 to 65535', () => {
    assert.match(parsePortEntry('70000', []).problem ?? '', /Ports go from 1 to 65535/)
    assert.match(parsePortEntry('0', []).problem ?? '', /Ports go from 1 to 65535/)
  })

  it('rejects text that is not a port', () => {
    assert.match(parsePortEntry('web', []).problem ?? '', /is not a port or a range/)
  })

  it('rejects ports already in the list and overlapping ranges', () => {
    const alreadyAdded = [{ first: 4200, last: 4200 }]
    assert.equal(parsePortEntry('4200', alreadyAdded).problem, '4200 is already in the list.')
    assert.equal(
      parsePortEntry('4190-4210', alreadyAdded).problem,
      '4190-4210 overlaps 4200, which is already in the list.',
    )
  })

  it('keeps the ports devenv forwards through for itself', () => {
    assert.match(parsePortEntry('61050', []).problem ?? '', /taken by devenv itself/)
  })
})

describe('port lists', () => {
  it('groups consecutive ports into ranges', () => {
    assert.deepEqual(portRanges([4200, 3001, 3000, 3002, 9229]), [
      { first: 3000, last: 3002 },
      { first: 4200, last: 4200 },
      { first: 9229, last: 9229 },
    ])
    assert.equal(formatPortList([4200, 3001, 3000, 3002]), '3000-3002, 4200')
  })

  it('combines ranges without duplicates', () => {
    assert.deepEqual(
      combinePorts([
        { first: 1, last: 3 },
        { first: 2, last: 4 },
      ]),
      [1, 2, 3, 4],
    )
  })

  it('forwards consecutive host ports to consecutive container ports', () => {
    assert.deepEqual(portForwards([4200, 3000, 3001]), [
      { host: { first: 3000, last: 3001 }, container: { first: 61_000, last: 61_001 } },
      { host: { first: 4200, last: 4200 }, container: { first: 61_002, last: 61_002 } },
    ])
  })

  it('limits a project to 100 forwarded ports', () => {
    assert.equal(tooManyPortsProblem(combinePorts([{ first: 8000, last: 8099 }])), undefined)
    assert.match(
      tooManyPortsProblem(combinePorts([{ first: 8000, last: 8100 }])) ?? '',
      /101 ports/,
    )
  })

  it('finds the ports below 1024', () => {
    assert.deepEqual(privilegedPorts([80, 443, 3000]), [80, 443])
  })
})

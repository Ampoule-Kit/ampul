import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatPortList, portRanges } from './ports.ts'

describe('port lists', () => {
  it('groups consecutive ports into ranges', () => {
    assert.deepEqual(portRanges([4200, 3001, 3000, 3002, 9229]), [
      { first: 3000, last: 3002 },
      { first: 4200, last: 4200 },
      { first: 9229, last: 9229 },
    ])
    assert.equal(formatPortList([4200, 3001, 3000, 3002, 3001]), '3000-3002, 4200')
  })

  it('formats an empty list as nothing', () => {
    assert.equal(formatPortList([]), '')
  })
})

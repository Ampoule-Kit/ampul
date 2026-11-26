import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { evaluatePortEntry } from './portEntry.ts'

describe('evaluatePortEntry', () => {
  it('adds what was typed', () => {
    assert.deepEqual(evaluatePortEntry('3000-3009', [], []), {
      kind: 'add',
      items: [{ first: 3000, last: 3009 }],
    })
  })

  it('finishes on an empty line once something was added', () => {
    assert.deepEqual(evaluatePortEntry('', [], [{ first: 80, last: 80 }]), { kind: 'finish' })
    assert.equal(evaluatePortEntry('', [], []).kind, 'problem')
  })

  it('refuses ports that overlap the common ports already picked', () => {
    assert.equal(evaluatePortEntry('4200', [{ first: 4200, last: 4200 }], []).kind, 'problem')
  })
})

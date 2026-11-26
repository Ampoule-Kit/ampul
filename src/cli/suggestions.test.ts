import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { closestMatch } from './suggestions.ts'

describe('closestMatch', () => {
  it('suggests the nearest candidate within two edits', () => {
    assert.equal(closestMatch('stopp', ['start', 'stop', 'setup']), 'stop')
    assert.equal(closestMatch('rebiuld', ['rebuild', 'remove']), 'rebuild')
  })

  it('suggests nothing when every candidate is too different', () => {
    assert.equal(closestMatch('deploy', ['start', 'stop']), undefined)
  })
})

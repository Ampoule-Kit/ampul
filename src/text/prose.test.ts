import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { joinInProse, pluralize } from './prose.ts'

describe('prose', () => {
  it('joins lists the way a sentence would', () => {
    assert.equal(joinInProse([]), '')
    assert.equal(joinInProse(['Editor']), 'Editor')
    assert.equal(joinInProse(['Editor', 'Runtime', 'search']), 'Editor, Runtime and search')
  })

  it('pluralizes counts', () => {
    assert.equal(pluralize(1, 'port'), '1 port')
    assert.equal(pluralize(3, 'repository', 'repositories'), '3 repositories')
  })
})

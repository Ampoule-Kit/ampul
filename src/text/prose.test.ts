import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { joinInProse, pluralize } from './prose.ts'

describe('prose', () => {
  it('joins lists the way a sentence would', () => {
    assert.equal(joinInProse([]), '')
    assert.equal(joinInProse(['Neovim']), 'Neovim')
    assert.equal(joinInProse(['Neovim', 'Node.js', 'fd']), 'Neovim, Node.js and fd')
  })

  it('pluralizes counts', () => {
    assert.equal(pluralize(1, 'port'), '1 port')
    assert.equal(pluralize(3, 'repository', 'repositories'), '3 repositories')
  })
})

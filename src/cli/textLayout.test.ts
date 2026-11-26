import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { wrap } from './textLayout.ts'

describe('wrap', () => {
  it('breaks text between words to fit the width, keeping the indent', () => {
    assert.deepEqual(wrap('one two three four five six', '  ', 22), [
      '  one two three four',
      '  five six',
    ])
  })
})

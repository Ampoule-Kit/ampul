import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { toggleSelection } from './multiSelection.ts'

describe('toggleSelection', () => {
  it('selects and unselects an option', () => {
    assert.deepEqual(toggleSelection([], { value: 'editor' }), ['editor'])
    assert.deepEqual(toggleSelection(['editor'], { value: 'editor' }), [])
  })

  it('unselects the options it is mutually exclusive with', () => {
    const full = { value: 'engine-full', exclusiveWith: ['engine-lite'] }
    assert.deepEqual(toggleSelection(['editor', 'engine-lite'], full), ['editor', 'engine-full'])
  })
})

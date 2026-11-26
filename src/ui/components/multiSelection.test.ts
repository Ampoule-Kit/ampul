import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { toggleSelection } from './multiSelection.ts'

const options = [
  { value: 'neovim' },
  { value: 'godot', exclusiveGroup: 'godot' },
  { value: 'godot-dotnet', exclusiveGroup: 'godot' },
]

describe('toggleSelection', () => {
  it('selects and unselects an option', () => {
    assert.deepEqual(toggleSelection([], { value: 'neovim' }, options), ['neovim'])
    assert.deepEqual(toggleSelection(['neovim'], { value: 'neovim' }, options), [])
  })

  it('unselects the other options of an exclusive group', () => {
    const godotDotnet = { value: 'godot-dotnet', exclusiveGroup: 'godot' }
    assert.deepEqual(toggleSelection(['neovim', 'godot'], godotDotnet, options), [
      'neovim',
      'godot-dotnet',
    ])
  })
})

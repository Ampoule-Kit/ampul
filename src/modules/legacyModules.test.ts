import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { withoutLegacyModules } from './legacyModules.ts'

describe('withoutLegacyModules', () => {
  it('turns the .NET and Godot modules of ampul 1.x into versions', () => {
    const upgraded = withoutLegacyModules({
      name: 'game',
      modules: ['node', 'dotnet-8', 'dotnet-10', 'godot-dotnet'],
      moduleVersions: {},
    })
    assert.deepEqual(upgraded, {
      name: 'game',
      modules: ['node', 'dotnet', 'godot'],
      moduleVersions: { dotnet: ['8', '10'], godot: ['4.7-dotnet'] },
    })
  })

  it('leaves a selection without them as it is', () => {
    const selection = { modules: ['node'], moduleVersions: { node: ['24'] } }
    assert.equal(withoutLegacyModules(selection), selection)
  })
})

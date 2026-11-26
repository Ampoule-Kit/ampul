import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { portPresets, presetsCoveredBy } from './portPresets.ts'

describe('presetsCoveredBy', () => {
  it('recognises presets whose every port is forwarded and keeps the rest as other ports', () => {
    assert.deepEqual(presetsCoveredBy([3000, 4200, 5000, 5001, 7000, 7001]), {
      presetIds: ['node-web', 'angular', 'aspnet'],
      otherPorts: [7000, 7001],
    })
  })

  it('does not pick a range preset when only part of it is forwarded', () => {
    assert.deepEqual(presetsCoveredBy([5000]), { presetIds: [], otherPorts: [5000] })
  })

  it('gives every preset a unique id and label', () => {
    assert.equal(new Set(portPresets.map((preset) => preset.id)).size, portPresets.length)
    assert.equal(new Set(portPresets.map((preset) => preset.label)).size, portPresets.length)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compareVersions, minimumVersions } from './repository.ts'

describe('versions', () => {
  it('compares dotted versions numerically', () => {
    assert.ok(compareVersions('26.13.1', '26.0.0') > 0)
    assert.ok(compareVersions('22.23.1', '26.0.0') < 0)
    assert.equal(compareVersions('11.0.0', '11.0.0'), 0)
  })

  it('reads the minimum versions from package.json', () => {
    const minimum = minimumVersions()
    assert.match(minimum.node, /^\d+\.\d+\.\d+$/)
    assert.match(minimum.npm, /^\d+\.\d+\.\d+$/)
  })
})

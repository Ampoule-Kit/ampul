import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { catalogForTests, moduleForTests } from '../modules/moduleForTests.ts'
import { offeredPortPresets, portPresetsOf, presetsCoveredBy } from './portPresets.ts'

const preset = (id: string, port: number, section: string, lastPort?: number) => ({
  id,
  label: id,
  port,
  ...(lastPort === undefined ? {} : { lastPort }),
  section,
  description: id,
})

const catalog = catalogForTests([
  moduleForTests('web', {
    portPresets: [preset('dev-server', 3000, 'Web'), preset('debugger', 9229, 'Debug')],
  }),
  moduleForTests('sdk-1', { portPresets: [preset('sdk-web', 5000, 'Web', 5001)] }),
  moduleForTests('sdk-2', { portPresets: [preset('sdk-web', 5000, 'Web', 5001)] }),
  moduleForTests('database', { portPresets: [preset('database', 5432, 'Services')] }),
])

describe('port presets', () => {
  it('lists the presets of the modules once each, grouped by section', () => {
    assert.deepEqual(
      portPresetsOf(catalog.modules).map((each) => each.id),
      ['dev-server', 'sdk-web', 'debugger', 'database'],
    )
  })

  it('offers only the presets of the selected modules', () => {
    assert.deepEqual(
      offeredPortPresets(['sdk-1', 'sdk-2'], catalog).map((each) => each.id),
      ['sdk-web'],
    )
  })

  it('recognises presets whose every port is forwarded and keeps the rest as other ports', () => {
    const presets = portPresetsOf(catalog.modules)
    assert.deepEqual(presetsCoveredBy([3000, 5000, 5001, 7000], presets), {
      presetIds: ['dev-server', 'sdk-web'],
      otherPorts: [7000],
    })
    assert.deepEqual(presetsCoveredBy([5000], presets), { presetIds: [], otherPorts: [5000] })
  })
})

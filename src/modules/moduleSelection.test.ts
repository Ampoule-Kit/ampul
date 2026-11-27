import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { catalogForTests, moduleForTests } from './moduleForTests.ts'
import {
  describeModuleSelection,
  installationOrder,
  moduleVolumes,
  mutuallyExclusiveIds,
  privilegedModuleLabels,
  requiringModuleLabels,
  selectionConflicts,
  withRequiredModules,
} from './moduleSelection.ts'

const volume = { name: 'data', path: '/data', contents: 'The data' }
const catalog = catalogForTests([
  moduleForTests('editor', { label: 'Editor', selectedByDefault: true, requires: ['runtime'] }),
  moduleForTests('runtime', { label: 'Runtime', selectedByDefault: true, requires: ['compiler'] }),
  moduleForTests('compiler', { label: 'Compiler', selectedByDefault: true }),
  moduleForTests('language', { label: 'Language' }),
  moduleForTests('engine-lite', { label: 'Engine lite', mutuallyExclusiveWith: ['engine-full'] }),
  moduleForTests('engine-full', {
    label: 'Engine full',
    container: { privileged: true, volumes: [volume] },
  }),
  moduleForTests('plugin', { label: 'Plugin', requires: ['engine-full'] }),
])

describe('module selection', () => {
  it('adds the modules a selected module requires, and theirs', () => {
    assert.deepEqual(withRequiredModules(['editor'], catalog), ['editor', 'runtime', 'compiler'])
  })

  it('installs every module after the modules it requires', () => {
    const order = installationOrder(['editor', 'plugin'], catalog).map((module) => module.id)
    assert.deepEqual(order, ['compiler', 'runtime', 'editor', 'engine-full', 'plugin'])
  })

  it('names the modules that keep a requirement selected', () => {
    assert.deepEqual(requiringModuleLabels(['plugin'], catalog).get('engine-full'), ['Plugin'])
  })

  it('describes a selection against the defaults', () => {
    const defaults = ['editor', 'runtime', 'compiler']
    assert.equal(describeModuleSelection(defaults, catalog), 'The defaults')
    assert.equal(describeModuleSelection([], catalog), 'No tools')
    assert.equal(describeModuleSelection(['language'], catalog), 'Only Language')
    assert.equal(
      describeModuleSelection([...defaults, 'language'], catalog),
      'The defaults, plus Language',
    )
  })
})

describe('mutually exclusive modules', () => {
  it('works both ways, whichever module names the other', () => {
    const [lite, full] = ['engine-lite', 'engine-full'].map((id) => catalog.byId.get(id))
    assert.ok(lite && full)
    assert.deepEqual(mutuallyExclusiveIds(lite, catalog), ['engine-full'])
    assert.deepEqual(mutuallyExclusiveIds(full, catalog), ['engine-lite'])
  })

  it('finds them in a selection, including those pulled in as requirements', () => {
    assert.deepEqual(selectionConflicts(['engine-lite'], catalog), [])
    assert.deepEqual(selectionConflicts(['engine-lite', 'plugin'], catalog), [
      { labels: ['Engine lite', 'Engine full'] },
    ])
  })
})

describe('what modules ask of the container', () => {
  it('collects the privileged modules and the volumes of a selection', () => {
    assert.deepEqual(privilegedModuleLabels(['plugin'], catalog), ['Engine full'])
    assert.deepEqual(privilegedModuleLabels(['engine-lite'], catalog), [])
    assert.deepEqual(moduleVolumes(['plugin'], catalog), [volume])
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { catalogForTests, moduleForTests, versionForTests } from './moduleForTests.ts'
import {
  describeModuleSelection,
  describeVersionChoices,
  installationOrder,
  moduleInstalls,
  moduleVolumes,
  mutuallyExclusiveIds,
  privilegedModuleLabels,
  requiringModuleLabels,
  requiringVersionLabels,
  selectionConflicts,
  selectionOf,
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
    assert.deepEqual(withRequiredModules(selectionOf(['editor']), catalog).modules, [
      'editor',
      'runtime',
      'compiler',
    ])
  })

  it('installs every module after the modules it requires', () => {
    const order = installationOrder(selectionOf(['editor', 'plugin']), catalog).map(
      (module) => module.id,
    )
    assert.deepEqual(order, ['compiler', 'runtime', 'editor', 'engine-full', 'plugin'])
  })

  it('names the modules that keep a requirement selected', () => {
    assert.deepEqual(requiringModuleLabels(selectionOf(['plugin']), catalog).get('engine-full'), [
      'Plugin',
    ])
  })

  it('describes a selection against the defaults', () => {
    const defaults = ['editor', 'runtime', 'compiler']
    assert.equal(describeModuleSelection(selectionOf(defaults), catalog), 'The defaults')
    assert.equal(describeModuleSelection(selectionOf([]), catalog), 'No tools')
    assert.equal(describeModuleSelection(selectionOf(['language']), catalog), 'Only Language')
    assert.equal(
      describeModuleSelection(selectionOf([...defaults, 'language']), catalog),
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
    assert.deepEqual(selectionConflicts(selectionOf(['engine-lite']), catalog), [])
    assert.deepEqual(selectionConflicts(selectionOf(['engine-lite', 'plugin']), catalog), [
      { labels: ['Engine lite', 'Engine full'] },
    ])
  })
})

describe('what modules ask of the container', () => {
  it('collects the privileged modules and the volumes of a selection', () => {
    assert.deepEqual(privilegedModuleLabels(selectionOf(['plugin']), catalog), ['Engine full'])
    assert.deepEqual(privilegedModuleLabels(selectionOf(['engine-lite']), catalog), [])
    assert.deepEqual(moduleVolumes(selectionOf(['plugin']), catalog), [volume])
  })
})

const sdkDownload = (version: string) => ({
  url: 'https://example.com/sdk-{version}-{arch}.tar.gz',
  architectures: { arm64: 'arm64', amd64: 'x64' },
  sha256: { arm64: 'a'.repeat(64), amd64: 'b'.repeat(64) },
  installTo: '/opt/sdk',
  sharedFolder: true,
  version,
})

describe('module versions', () => {
  const versioned = catalogForTests([
    moduleForTests('runtime', {
      label: 'Runtime',
      hasVersionChoice: true,
      versions: [versionForTests('24'), versionForTests('22')],
    }),
    moduleForTests('sdk', {
      label: 'SDK',
      hasVersionChoice: true,
      multipleVersions: true,
      versions: [
        versionForTests('10', { downloads: [sdkDownload('10.0.1')] }),
        versionForTests('8', { downloads: [sdkDownload('8.0.1')] }),
      ],
    }),
    moduleForTests('engine', {
      label: 'Engine',
      hasVersionChoice: true,
      versions: [
        versionForTests('4', { label: '4 Script' }),
        versionForTests('4-sdk', { label: '4 SDK', requires: ['sdk@8'] }),
      ],
    }),
  ])
  const installsOf = (modules: string[], moduleVersions: Record<string, string[]> = {}) =>
    moduleInstalls(selectionOf(modules, moduleVersions), versioned).map(
      (install) => `${install.id}@${install.versionId}`,
    )

  it('picks the newest version of a module unless another one was chosen', () => {
    assert.deepEqual(installsOf(['runtime']), ['runtime@24'])
    assert.deepEqual(installsOf(['runtime'], { runtime: ['22'] }), ['runtime@22'])
    assert.deepEqual(installsOf(['runtime'], { runtime: ['gone'] }), ['runtime@24'])
  })

  it('keeps one version of a module that takes one, and every chosen one of the others', () => {
    assert.deepEqual(installsOf(['runtime'], { runtime: ['24', '22'] }), ['runtime@24'])
    assert.deepEqual(installsOf(['sdk'], { sdk: ['8', '10'] }), ['sdk@10', 'sdk@8'])
  })

  it('brings just the version another version requires, and installs it first', () => {
    assert.deepEqual(installsOf(['engine'], { engine: ['4-sdk'] }), ['sdk@8', 'engine@4-sdk'])
    assert.deepEqual(installsOf(['engine']), ['engine@4'])
  })

  it('adds a required version to the versions chosen of that module', () => {
    assert.deepEqual(installsOf(['engine'], { engine: ['4-sdk'], sdk: ['10'] }), [
      'sdk@10',
      'sdk@8',
      'engine@4-sdk',
    ])
    assert.deepEqual(installsOf(['sdk', 'engine'], { engine: ['4-sdk'] }), [
      'sdk@10',
      'sdk@8',
      'engine@4-sdk',
    ])
  })

  it('records the versions of a selection, and says what keeps a version selected', () => {
    const selection = selectionOf(['engine'], { engine: ['4-sdk'] })
    assert.deepEqual(withRequiredModules(selection, versioned), {
      modules: ['sdk', 'engine'],
      moduleVersions: { sdk: ['8'], engine: ['4-sdk'] },
    })
    assert.deepEqual(requiringVersionLabels(selection, versioned, 'sdk', '8'), ['Engine'])
    assert.equal(describeVersionChoices(selection, versioned), 'SDK 8, Engine 4 SDK')
  })
})

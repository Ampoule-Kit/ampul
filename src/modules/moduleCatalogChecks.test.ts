import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Problem } from '../problems/Problem.ts'
import type { ModuleDefinition } from './ModuleDefinition.ts'
import { checkModuleCatalog } from './moduleCatalogChecks.ts'
import { type ModuleOverridesForTests, moduleForTests, versionForTests } from './moduleForTests.ts'
import type { ModuleDownload } from './moduleSchema.ts'

function module(
  id: string,
  requires: string[] = [],
  overrides: ModuleOverridesForTests = {},
): ModuleDefinition {
  return moduleForTests(id, { requires, ...overrides })
}

function download(installTo: string, sharedFolder = false): ModuleDownload {
  return {
    url: 'https://example.com/{arch}.tar.gz',
    architectures: { arm64: 'arm64', amd64: 'x64' },
    installTo,
    sharedFolder,
  }
}

function check(modules: ModuleDefinition[], folders = modules.map((each) => each.id)): void {
  checkModuleCatalog(modules, new Map(modules.map((each) => [each.id, each])), folders)
}

describe('checkModuleCatalog', () => {
  it('accepts a consistent catalog', () => {
    assert.doesNotThrow(() => check([module('a', ['b']), module('b')]))
  })

  it('reports a requirement that does not exist', () => {
    assert.throws(
      () => check([module('a', ['missing'])]),
      (error) => {
        return error instanceof Problem && error.title.includes("requires 'missing'")
      },
    )
  })

  it('reports modules that require each other in a circle', () => {
    assert.throws(
      () => check([module('a', ['b']), module('b', ['a'])]),
      (error) => {
        return error instanceof Problem && (error.explanation ?? '').includes('a → b → a')
      },
    )
  })

  it('reports a module folder the catalog does not list', () => {
    assert.throws(() => check([module('a')], ['a', 'forgotten']), /does not list forgotten/)
  })

  it('reports a module that needs two mutually exclusive modules', () => {
    assert.throws(
      () =>
        check([
          module('a', ['b', 'c']),
          module('b'),
          module('c', [], { mutuallyExclusiveWith: ['b'] }),
        ]),
      /needs both 'b' and 'c'/,
    )
  })

  it('reports a module that is mutually exclusive with one that does not exist', () => {
    assert.throws(
      () => check([module('a', [], { mutuallyExclusiveWith: ['missing'] })]),
      /mutually exclusive with 'missing'/,
    )
  })

  it('reports modules that install to the same folder and could be selected together', () => {
    assert.throws(
      () =>
        check([
          module('a', [], { downloads: [download('/opt/tool')] }),
          module('b', [], { downloads: [download('/opt/tool')] }),
        ]),
      /both install to \/opt\/tool/,
    )
  })

  it('accepts a shared install folder, or one used by mutually exclusive modules', () => {
    assert.doesNotThrow(() =>
      check([
        module('a', [], { downloads: [download('/opt/sdk', true)] }),
        module('b', [], { downloads: [download('/opt/sdk', true)] }),
        module('c', [], { mutuallyExclusiveWith: ['d'], downloads: [download('/opt/tool')] }),
        module('d', [], { downloads: [download('/opt/tool')] }),
      ]),
    )
  })

  it('reports two modules with a volume of the same name', () => {
    const volume = { name: 'data', path: '/data', contents: 'Data' }
    const withVolume = { container: { privileged: false, volumes: [volume] } }
    assert.throws(
      () => check([module('a', [], withVolume), module('b', [], withVolume)]),
      /both have a volume named 'data'/,
    )
  })
})

const sdk = (overrides: ModuleOverridesForTests = {}) =>
  module('sdk', [], {
    hasVersionChoice: true,
    versions: [
      versionForTests('10', { downloads: [download('/opt/sdk', true)] }),
      versionForTests('8', { downloads: [download('/opt/sdk', true)] }),
    ],
    multipleVersions: true,
    ...overrides,
  })

it('accepts a requirement of one version of a module with multipleVersions', () => {
  assert.doesNotThrow(() => check([module('engine', ['sdk@8']), sdk()]))
})

describe('checkModuleCatalog with versions', () => {
  it('reports a requirement of a version that does not exist', () => {
    assert.throws(
      () => check([module('engine', ['sdk@6']), sdk()]),
      /requires version '6' of 'sdk'/,
    )
  })

  it('reports a requirement of one version of a module that installs one version at a time', () => {
    assert.throws(
      () => check([module('engine', ['sdk@8']), sdk({ multipleVersions: false })]),
      /only installs one version at a time/,
    )
  })

  it('lets the versions of a module that installs one at a time share a folder', () => {
    const versions = [
      versionForTests('2', { downloads: [download('/opt/tool')] }),
      versionForTests('1', { downloads: [download('/opt/tool')] }),
    ]
    assert.doesNotThrow(() => check([module('tool', [], { hasVersionChoice: true, versions })]))
    assert.throws(
      () =>
        check([module('tool', [], { hasVersionChoice: true, multipleVersions: true, versions })]),
      /Versions '2' and '1' of 'tool' both install to \/opt\/tool/,
    )
  })
})

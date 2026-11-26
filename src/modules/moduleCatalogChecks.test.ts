import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Problem } from '../problems/Problem.ts'
import type { ModuleDefinition } from './ModuleDefinition.ts'
import { checkModuleCatalog } from './moduleCatalogChecks.ts'

function module(id: string, requires: string[] = []): ModuleDefinition {
  return {
    id,
    label: id,
    description: id,
    section: 'Tools',
    selectedByDefault: false,
    requires,
    packages: [],
    downloads: [],
    environment: {},
    path: [],
    hasConfig: false,
    hasSetup: false,
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
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { moduleCatalog } from './moduleCatalog.ts'
import {
  describeModuleSelection,
  installationOrder,
  requiringModuleLabels,
  withRequiredModules,
} from './moduleSelection.ts'

describe('module selection', () => {
  const catalog = moduleCatalog()

  it('adds the modules a selected module requires', () => {
    const selected = withRequiredModules(['neovim'], catalog)
    for (const required of ['node', 'tree-sitter', 'ripgrep', 'fd', 'build-essential']) {
      assert.ok(selected.includes(required), required)
    }
  })

  it('installs every module after the modules it requires', () => {
    const order = installationOrder(['neovim', 'godot-dotnet'], catalog).map((module) => module.id)
    for (const module of installationOrder(['neovim', 'godot-dotnet'], catalog)) {
      for (const required of module.requires) {
        assert.ok(
          order.indexOf(required) < order.indexOf(module.id),
          `${required} before ${module.id}`,
        )
      }
    }
  })

  it('names the modules that keep a requirement selected', () => {
    const requiredBy = requiringModuleLabels(['godot-dotnet'], catalog)
    assert.deepEqual(requiredBy.get('dotnet-8'), ['Godot (.NET)'])
  })

  it('describes a selection against the defaults', () => {
    const defaults = catalog.modules
      .filter((module) => module.selectedByDefault)
      .map((module) => module.id)
    assert.equal(describeModuleSelection(defaults, catalog), 'The defaults')
    assert.equal(describeModuleSelection([], catalog), 'No tools')
    assert.equal(describeModuleSelection(['python'], catalog), 'Only Python (pip, venv, headers)')
  })
})

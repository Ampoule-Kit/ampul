import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { catalogForTests, moduleForTests } from '../modules/moduleForTests.ts'
import { parseLegacySettings } from './legacySettings.ts'
import { migrateToModules, modulesForLegacyValue } from './settingsMigration.ts'

const bashSettings = `PROJECT_NAME=api
CODE_SOURCE=repositories
REPOSITORIES='git@github.com:team/api.git https://github.com/team/web.git'
DOTNET_SDKS='8 10'
GODOT=dotnet
CONTAINER_ENGINE=yes
PYTHON=
PORTS='4200 5000'
`

describe('settings from the bash version', () => {
  it('reads the bash quoting of the old .env files', () => {
    const settings = parseLegacySettings(bashSettings, 'api')
    assert.deepEqual(settings.codeSource, {
      kind: 'repositories',
      repositories: ['git@github.com:team/api.git', 'https://github.com/team/web.git'],
    })
    assert.deepEqual(settings.dotnetSdks, ['8', '10'])
    assert.deepEqual(settings.optionalDependencies, { GODOT: 'dotnet', CONTAINER_ENGINE: 'yes' })
    assert.deepEqual(settings.ports, [4200, 5000])
  })

  it('turns the old choices into modules, with what they require', () => {
    const migrated = migrateToModules(parseLegacySettings(bashSettings, 'api'))
    for (const expected of [
      'neovim',
      'dotnet-8',
      'dotnet-10',
      'godot-dotnet',
      'container-engine',
    ]) {
      assert.ok(migrated.modules.includes(expected), `expected ${expected}`)
    }
    assert.ok(!migrated.modules.includes('python'))
    assert.ok(!migrated.modules.includes('godot'))
  })

  it('prefers a module that names the exact old value over one that takes any value', () => {
    const catalog = catalogForTests([
      moduleForTests('engine', { legacySettings: [{ setting: 'ENGINE' }] }),
      moduleForTests('engine-plus', { legacySettings: [{ setting: 'ENGINE', value: 'plus' }] }),
    ])
    assert.deepEqual(modulesForLegacyValue({ setting: 'ENGINE', value: 'plus' }, catalog), [
      'engine-plus',
    ])
    assert.deepEqual(modulesForLegacyValue({ setting: 'ENGINE', value: 'yes' }, catalog), [
      'engine',
    ])
    assert.deepEqual(modulesForLegacyValue({ setting: 'OTHER', value: 'yes' }, catalog), [])
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { catalogForTests, moduleForTests } from '../modules/moduleForTests.ts'
import { parseLegacySettings } from './legacySettings.ts'
import { settingsBeforeModulesSchema } from './ProjectSettings.ts'
import { migrateToModules, modulesForLegacyValue } from './settingsMigration.ts'

const bashSettings = `PROJECT_NAME=api
CODE_SOURCE=repositories
REPOSITORIES='git@github.com:team/api.git https://github.com/team/web.git'
TOOL_SDKS='1 2'
ENGINE=plus
CONTAINERS=yes
LANGUAGE=
PORTS='4200 5000'
`

const catalog = catalogForTests([
  moduleForTests('editor', { selectedByDefault: true }),
  moduleForTests('sdk-1', { legacySettings: [{ setting: 'TOOL_SDKS', value: '1' }] }),
  moduleForTests('sdk-2', { legacySettings: [{ setting: 'TOOL_SDKS', value: '2' }] }),
  moduleForTests('engine', { legacySettings: [{ setting: 'ENGINE' }] }),
  moduleForTests('engine-plus', {
    requires: ['sdk-1'],
    legacySettings: [{ setting: 'ENGINE', value: 'plus' }],
  }),
  moduleForTests('containers', { legacySettings: [{ setting: 'CONTAINERS' }] }),
  moduleForTests('language', { legacySettings: [{ setting: 'LANGUAGE' }] }),
])

describe('settings from the bash version', () => {
  it('reads the bash quoting of the old .env files', () => {
    const settings = parseLegacySettings(bashSettings, 'api')
    assert.deepEqual(settings.codeSource, {
      kind: 'repositories',
      repositories: ['git@github.com:team/api.git', 'https://github.com/team/web.git'],
    })
    assert.deepEqual(settings.legacySettings, {
      TOOL_SDKS: ['1', '2'],
      ENGINE: ['plus'],
      CONTAINERS: ['yes'],
    })
    assert.deepEqual(settings.ports, [4200, 5000])
  })

  it('turns the old choices into modules, with what they require', () => {
    const migrated = migrateToModules(parseLegacySettings(bashSettings, 'api'), catalog)
    assert.deepEqual(migrated.modules, ['editor', 'sdk-1', 'sdk-2', 'engine-plus', 'containers'])
  })

  it('reads the lists of the JSON settings from before modules under their old names', () => {
    const settings = settingsBeforeModulesSchema.parse({
      name: 'api',
      codeSource: { kind: 'pass-through' },
      ports: [],
      toolSdks: ['2'],
      optionalDependencies: { ENGINE: 'yes' },
    })
    assert.deepEqual(settings.legacySettings, { ENGINE: ['yes'], TOOL_SDKS: ['2'] })
    assert.deepEqual(migrateToModules(settings, catalog).modules, ['editor', 'sdk-2', 'engine'])
  })

  it('prefers a module that names the exact old value over one that takes any value', () => {
    assert.deepEqual(modulesForLegacyValue({ setting: 'ENGINE', value: 'plus' }, catalog), [
      'engine-plus',
    ])
    assert.deepEqual(modulesForLegacyValue({ setting: 'ENGINE', value: 'yes' }, catalog), [
      'engine',
    ])
    assert.deepEqual(modulesForLegacyValue({ setting: 'OTHER', value: 'yes' }, catalog), [])
  })
})

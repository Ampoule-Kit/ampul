import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { catalogForTests, moduleForTests, versionForTests } from '../modules/moduleForTests.ts'
import { moduleInstalls, selectionOf } from '../modules/moduleSelection.ts'
import { containerfileFor } from './containerfile.ts'
import { containerHome } from './naming.ts'

describe('containerfileFor', () => {
  const catalog = catalogForTests([
    moduleForTests('runtime', { path: ['/opt/runtime/bin'] }),
    moduleForTests('editor', { requires: ['runtime'] }),
    moduleForTests('language', {
      environment: { LANGUAGE_HOME: '/opt/language', LANGUAGE_CACHE: '{home}/.cache/language' },
      path: ['/opt/language/bin'],
    }),
    moduleForTests('unused'),
  ])
  const containerfile = containerfileFor(
    moduleInstalls(selectionOf(['editor', 'language']), catalog),
  )

  it('installs each module in its own cached step, requirements first', () => {
    const runtimeStep = containerfile.indexOf('install-module.sh runtime')
    const editorStep = containerfile.indexOf('install-module.sh editor')
    assert.ok(runtimeStep > 0 && editorStep > runtimeStep)
    assert.match(containerfile, /COPY modules\/language\/ \/opt\/ampul\/modules\/language\//)
  })

  it('leaves out the modules that were not selected', () => {
    assert.doesNotMatch(containerfile, /install-module\.sh unused\b/)
  })

  it('merges the environment of the selected modules, with the home folder filled in', () => {
    assert.match(containerfile, /LANGUAGE_HOME="\/opt\/language"/)
    assert.match(containerfile, new RegExp(`LANGUAGE_CACHE="${containerHome()}/\\.cache/language"`))
    assert.match(containerfile, /PATH="\/opt\/runtime\/bin:\/opt\/language\/bin:\$\{PATH\}"/)
  })

  it('records the installed modules in installation order, for their start scripts', () => {
    const line = containerfile.split('\n').find((each) => each.includes('installed-modules'))
    assert.equal(line, "RUN printf '%s\\n' runtime editor language >/opt/ampul/installed-modules")
  })
})

describe('containerfileFor with module versions', () => {
  const catalog = catalogForTests([
    moduleForTests('sdk', {
      hasVersionChoice: true,
      multipleVersions: true,
      versions: [versionForTests('10'), versionForTests('8')],
    }),
  ])
  const containerfile = containerfileFor(
    moduleInstalls(selectionOf(['sdk'], { sdk: ['10', '8'] }), catalog),
  )

  it('copies a module once and installs each of its versions in its own step', () => {
    assert.equal(containerfile.match(/COPY modules\/sdk\//g)?.length, 1)
    assert.match(containerfile, /install-module\.sh sdk 10\n/)
    assert.match(containerfile, /install-module\.sh sdk 8\n/)
    assert.match(containerfile, /printf '%s\\n' sdk >/)
  })
})

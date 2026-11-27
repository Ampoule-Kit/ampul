import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { moduleCatalog } from '../modules/moduleCatalog.ts'
import { installationOrder } from '../modules/moduleSelection.ts'
import { containerfileFor } from './containerfile.ts'
import { containerHome } from './naming.ts'

describe('containerfileFor', () => {
  const catalog = moduleCatalog()
  const containerfile = containerfileFor(installationOrder(['neovim', 'java', 'dotnet-8'], catalog))

  it('installs each module in its own cached step, requirements first', () => {
    const nodeStep = containerfile.indexOf('install-module.sh node')
    const neovimStep = containerfile.indexOf('install-module.sh neovim')
    assert.ok(nodeStep > 0 && neovimStep > nodeStep)
    assert.match(containerfile, /COPY modules\/java\/ \/opt\/ampul\/modules\/java\//)
  })

  it('leaves out the modules that were not selected', () => {
    assert.doesNotMatch(containerfile, /install-module\.sh (yazi|python)\b/)
  })

  it('merges the environment of the selected modules, with the home folder filled in', () => {
    assert.match(containerfile, /JAVA_HOME="\/opt\/java"/)
    assert.match(containerfile, new RegExp(`NUGET_PACKAGES="${containerHome()}/\\.cache/nuget"`))
    assert.match(containerfile, /PATH="\/opt\/node\/bin:.*\/opt\/java\/bin:.*\$\{PATH\}"/)
  })

  it('records the installed modules in installation order, for their start scripts', () => {
    const line = containerfile.split('\n').find((each) => each.includes('installed-modules'))
    assert.equal(
      line,
      "RUN printf '%s\\n' node build-essential tree-sitter ripgrep fd neovim java dotnet-8 >/opt/ampul/installed-modules",
    )
  })
})

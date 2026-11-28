import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ProjectSettings } from '../projects/ProjectSettings.ts'
import { homeDirectory } from '../system/platform.ts'
import { containerCodeDirectory } from './naming.ts'
import { codeMounts } from './projectCode.ts'

function projectWith(codeSource: ProjectSettings['codeSource']): ProjectSettings {
  return { name: 'api', codeSource, modules: [], moduleVersions: {} }
}

describe('codeMounts', () => {
  it('mounts nothing for cloned repositories', () => {
    assert.deepEqual(codeMounts(projectWith({ kind: 'repositories', repositories: [] })), [])
  })

  it('mounts each folder under its own name', () => {
    const [mount] = codeMounts(projectWith({ kind: 'folders', folders: [import.meta.dirname] }))
    assert.equal(mount?.hostPath, import.meta.dirname)
    assert.equal(mount?.containerPath, `${containerCodeDirectory()}/containers`)
    assert.equal(mount?.readOnly, false)
  })

  it('refuses a folder that no longer exists', () => {
    const missing = projectWith({ kind: 'folders', folders: ['/no/such/folder'] })
    assert.throws(() => codeMounts(missing), /no longer exists/)
  })

  it('mounts the home folder at ~/work in pass-through mode', () => {
    assert.deepEqual(codeMounts(projectWith({ kind: 'pass-through' })), [
      { hostPath: homeDirectory, containerPath: containerCodeDirectory(), readOnly: false },
    ])
  })
})

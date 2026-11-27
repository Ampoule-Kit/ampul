import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { unsharedFoldersIn } from './folderSharing.ts'

const folders = ['/Volumes/External/api', '/Users/you/code/web']

describe('unsharedFoldersIn', () => {
  it('names the folder the engine could not reach', () => {
    const podmanError = 'Error: statfs /Volumes/External/api: no such file or directory'
    assert.deepEqual(unsharedFoldersIn(podmanError, folders), ['/Volumes/External/api'])
  })

  it('blames every folder when the error does not say which one', () => {
    const dockerError = 'docker: Error response from daemon: Mounts denied: path is not shared'
    assert.deepEqual(unsharedFoldersIn(dockerError, folders), folders)
  })

  it('blames a folder for permission problems only when the error names it', () => {
    assert.deepEqual(unsharedFoldersIn('permission denied', folders), [])
    assert.deepEqual(unsharedFoldersIn('open /Users/you/code/web: permission denied', folders), [
      '/Users/you/code/web',
    ])
  })

  it('ignores errors that have nothing to do with folders', () => {
    assert.deepEqual(unsharedFoldersIn('port is already allocated', folders), [])
  })
})

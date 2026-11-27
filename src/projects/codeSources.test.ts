import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'
import { mountedFolderProblem, repositoryFolderName, repositoryUrlProblem } from './codeSources.ts'

describe('repository URLs', () => {
  it('finds the folder git clones into', () => {
    assert.equal(repositoryFolderName('git@github.com:you/project.git'), 'project')
    assert.equal(repositoryFolderName('https://example.com/team/api/'), 'api')
    assert.equal(repositoryFolderName('git@host:service'), 'service')
  })

  it('rejects URLs that would clone into the same folder', () => {
    assert.match(
      repositoryUrlProblem('https://github.com/b/api.git', ['git@github.com:a/api.git']) ?? '',
      /already clones into ~\/work\/api/,
    )
  })

  it('rejects text that is not a URL', () => {
    assert.match(repositoryUrlProblem('not a url', []) ?? '', /does not look like/)
  })
})

describe('mounted folders', () => {
  it('rejects folders that would mount at the same place', () => {
    const apiFolder = path.join('code', 'api')
    const otherApiFolder = path.join('work', 'api')
    assert.match(
      mountedFolderProblem(otherApiFolder, [apiFolder]) ?? '',
      /already mounted at ~\/work\/api/,
    )
    assert.equal(mountedFolderProblem(path.join('code', 'web'), [apiFolder]), undefined)
  })

  it('rejects folders with a colon in their path', () => {
    assert.match(mountedFolderProblem('/code/a:b', []) ?? '', /colon/)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { repositoryFolderName, repositoryUrlProblem } from './codeSources.ts'

describe('repository URLs', () => {
  it('finds the folder git clones into', () => {
    assert.equal(repositoryFolderName('git@github.com:you/project.git'), 'project')
    assert.equal(repositoryFolderName('https://example.com/team/api/'), 'api')
    assert.equal(repositoryFolderName('git@host:service'), 'service')
  })

  it('rejects URLs that would clone into the same folder', () => {
    assert.match(
      repositoryUrlProblem('https://github.com/b/api.git', ['git@github.com:a/api.git']) ?? '',
      /already clones into ~\/Project\/api/,
    )
  })

  it('rejects text that is not a URL', () => {
    assert.match(repositoryUrlProblem('not a url', []) ?? '', /does not look like/)
  })
})

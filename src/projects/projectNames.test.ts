import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { projectNameFormatProblem, toProjectName } from './projectNames.ts'

describe('project names', () => {
  it('turns any text into a valid project name', () => {
    assert.equal(toProjectName('My Cool_App!'), 'my-cool-app')
    assert.equal(toProjectName('--api--'), 'api')
  })

  it('accepts lowercase names with digits and dashes', () => {
    assert.equal(projectNameFormatProblem('api-2'), undefined)
    assert.equal(projectNameFormatProblem(''), 'Enter a name.')
    assert.match(projectNameFormatProblem('Api') ?? '', /lowercase/)
  })
})

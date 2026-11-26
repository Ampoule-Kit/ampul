import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { firstActiveStepIndex, type NavigableStep, nextStepIndex } from './wizardNavigation.ts'

interface Draft {
  usesFolder: boolean
  name: string
}

const steps: NavigableStep<Draft>[] = [
  { id: 'code' },
  { id: 'folder', isSkipped: (draft) => !draft.usesFolder },
  { id: 'name', isComplete: (draft) => draft.name !== '' },
  { id: 'tools' },
  { id: 'review' },
]

describe('wizard navigation', () => {
  it('skips steps that do not apply, in either direction', () => {
    const draft = { usesFolder: false, name: '' }
    assert.equal(firstActiveStepIndex(steps, draft, 1, 1), 2)
    assert.equal(firstActiveStepIndex(steps, draft, 1, -1), 0)
  })

  it('returns to the review after a change, stopping at unanswered steps', () => {
    assert.equal(nextStepIndex(steps, { usesFolder: false, name: 'api' }, 0, 'review'), 4)
    assert.equal(nextStepIndex(steps, { usesFolder: false, name: '' }, 0, 'review'), 2)
  })
})

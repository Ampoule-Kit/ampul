import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Key } from 'ink'
import { applyEditingKey } from './textEditing.ts'

const noKey: Key = {
  upArrow: false,
  downArrow: false,
  leftArrow: false,
  rightArrow: false,
  pageDown: false,
  pageUp: false,
  home: false,
  end: false,
  return: false,
  escape: false,
  ctrl: false,
  shift: false,
  tab: false,
  backspace: false,
  delete: false,
  meta: false,
  super: false,
  hyper: false,
  capsLock: false,
  numLock: false,
}

function press(overrides: Partial<Key>): Key {
  return { ...noKey, ...overrides }
}

describe('applyEditingKey', () => {
  it('types at the cursor', () => {
    assert.deepEqual(applyEditingKey({ value: 'ac', cursor: 1 }, 'b', noKey), {
      value: 'abc',
      cursor: 2,
    })
  })

  it('turns pasted line breaks into spaces', () => {
    assert.deepEqual(applyEditingKey({ value: '', cursor: 0 }, 'a\nb', noKey), {
      value: 'a b',
      cursor: 3,
    })
  })

  it('deletes the character before the cursor, and nothing at the start', () => {
    assert.deepEqual(applyEditingKey({ value: 'abc', cursor: 3 }, '', press({ backspace: true })), {
      value: 'ab',
      cursor: 2,
    })
    assert.equal(
      applyEditingKey({ value: 'abc', cursor: 0 }, '', press({ backspace: true })),
      undefined,
    )
  })

  it('deletes the word before the cursor with ctrl+w', () => {
    assert.deepEqual(
      applyEditingKey({ value: '~/code/api', cursor: 10 }, 'w', press({ ctrl: true })),
      {
        value: '~/code/',
        cursor: 7,
      },
    )
  })

  it('ignores keys that do not edit', () => {
    assert.equal(
      applyEditingKey({ value: 'a', cursor: 1 }, '', press({ upArrow: true })),
      undefined,
    )
  })
})

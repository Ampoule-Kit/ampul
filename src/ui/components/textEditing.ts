import type { Key } from 'ink'

export interface TextFieldState {
  value: string
  cursor: number
}

const trailingWhitespace = /\s+$/
const lineBreaks = /[\r\n]+/g

function previousWordBoundary(value: string, cursor: number): number {
  const beforeCursor = value.slice(0, cursor).replace(trailingWhitespace, '')
  const lastSeparator = Math.max(beforeCursor.lastIndexOf(' '), beforeCursor.lastIndexOf('/'))
  return lastSeparator + 1
}

function deleteWordBeforeCursor({ value, cursor }: TextFieldState): TextFieldState {
  const boundary = previousWordBoundary(value, cursor)
  return { value: value.slice(0, boundary) + value.slice(cursor), cursor: boundary }
}

function deleteCharacterBeforeCursor({
  value,
  cursor,
}: TextFieldState): TextFieldState | undefined {
  if (cursor === 0) return undefined
  return { value: value.slice(0, cursor - 1) + value.slice(cursor), cursor: cursor - 1 }
}

function insertAtCursor({ value, cursor }: TextFieldState, typed: string): TextFieldState {
  const singleLine = typed.replaceAll(lineBreaks, ' ')
  return {
    value: value.slice(0, cursor) + singleLine + value.slice(cursor),
    cursor: cursor + singleLine.length,
  }
}

function isNonTypingKey(key: Key): boolean {
  return key.ctrl || key.meta || key.upArrow || key.downArrow || key.tab || key.escape
}

export function applyEditingKey(
  state: TextFieldState,
  input: string,
  key: Key,
): TextFieldState | undefined {
  const { value, cursor } = state
  if (key.leftArrow) return { value, cursor: Math.max(0, cursor - 1) }
  if (key.rightArrow) return { value, cursor: Math.min(value.length, cursor + 1) }
  if (key.home || (key.ctrl && input === 'a')) return { value, cursor: 0 }
  if (key.end || (key.ctrl && input === 'e')) return { value, cursor: value.length }
  if (key.ctrl && input === 'u') return { value: value.slice(cursor), cursor: 0 }
  if (key.ctrl && input === 'w') return deleteWordBeforeCursor(state)
  if (key.backspace || key.delete) return deleteCharacterBeforeCursor(state)
  if (isNonTypingKey(key) || !input) return undefined
  return insertAtCursor(state, input)
}

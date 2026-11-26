import { Text, useInput, type Key } from 'ink'
import { useState } from 'react'
import { colors } from '../theme.js'

interface TextFieldProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onCancel?: () => void
  onTab?: (value: string) => string
  onBackspaceWhenEmpty?: () => void
  placeholder?: string
}

interface EditResult {
  value: string
  cursor: number
}

function previousWordBoundary(value: string, cursor: number): number {
  const beforeCursor = value.slice(0, cursor).replace(/\s+$/, '')
  const lastSeparator = Math.max(beforeCursor.lastIndexOf(' '), beforeCursor.lastIndexOf('/'))
  return lastSeparator + 1
}

function applyKey(value: string, cursor: number, input: string, key: Key): EditResult | undefined {
  if (key.leftArrow) return { value, cursor: Math.max(0, cursor - 1) }
  if (key.rightArrow) return { value, cursor: Math.min(value.length, cursor + 1) }
  if (key.home || (key.ctrl && input === 'a')) return { value, cursor: 0 }
  if (key.end || (key.ctrl && input === 'e')) return { value, cursor: value.length }
  if (key.ctrl && input === 'u') return { value: value.slice(cursor), cursor: 0 }
  if (key.ctrl && input === 'w') {
    const boundary = previousWordBoundary(value, cursor)
    return { value: value.slice(0, boundary) + value.slice(cursor), cursor: boundary }
  }
  if (key.backspace || key.delete) {
    if (cursor === 0) return undefined
    return { value: value.slice(0, cursor - 1) + value.slice(cursor), cursor: cursor - 1 }
  }
  if (key.ctrl || key.meta || key.upArrow || key.downArrow || key.tab || key.escape) return undefined
  if (!input) return undefined
  const typed = input.replace(/[\r\n]+/g, ' ')
  return { value: value.slice(0, cursor) + typed + value.slice(cursor), cursor: cursor + typed.length }
}

export function TextField({
  value,
  onChange,
  onSubmit,
  onCancel,
  onTab,
  onBackspaceWhenEmpty,
  placeholder,
}: TextFieldProps) {
  const [cursor, setCursor] = useState(value.length)
  const cursorPosition = Math.min(cursor, value.length)

  useInput((input, key) => {
    if (key.return) return onSubmit(value)
    if (key.escape && onCancel) return onCancel()
    if (key.tab && onTab) {
      const completed = onTab(value)
      setCursor(completed.length)
      return onChange(completed)
    }
    if ((key.backspace || key.delete) && value === '' && onBackspaceWhenEmpty) {
      return onBackspaceWhenEmpty()
    }
    const edit = applyKey(value, cursorPosition, input, key)
    if (!edit) return
    setCursor(edit.cursor)
    if (edit.value !== value) onChange(edit.value)
  })

  if (!value && placeholder) {
    return (
      <Text>
        <Text inverse>{placeholder[0]}</Text>
        <Text color={colors.muted}>{placeholder.slice(1)}</Text>
      </Text>
    )
  }

  return (
    <Text>
      {value.slice(0, cursorPosition)}
      <Text inverse>{value[cursorPosition] ?? ' '}</Text>
      {value.slice(cursorPosition + 1)}
    </Text>
  )
}

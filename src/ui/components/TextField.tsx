import { Text, useInput } from 'ink'
import { useState } from 'react'
import { colors } from '../theme.ts'
import { applyEditingKey } from './textEditing.ts'

interface TextFieldProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onCancel?: (() => void) | undefined
  onTab?: ((value: string) => string) | undefined
  onBackspaceWhenEmpty?: (() => void) | undefined
  placeholder?: string | undefined
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
    if (key.return) {
      onSubmit(value)
    } else if (key.escape && onCancel) {
      onCancel()
    } else if (key.tab && onTab) {
      const completedValue = onTab(value)
      setCursor(completedValue.length)
      onChange(completedValue)
    } else if ((key.backspace || key.delete) && value === '' && onBackspaceWhenEmpty) {
      onBackspaceWhenEmpty()
    } else {
      const edited = applyEditingKey({ value, cursor: cursorPosition }, input, key)
      if (!edited) return
      setCursor(edited.cursor)
      if (edited.value !== value) onChange(edited.value)
    }
  })

  if (!value && placeholder) {
    return (
      <Text>
        <Text inverse>{placeholder.charAt(0)}</Text>
        <Text color={colors.muted}>{placeholder.slice(1)}</Text>
      </Text>
    )
  }

  return (
    <Text>
      {value.slice(0, cursorPosition)}
      <Text inverse>{value.charAt(cursorPosition) || ' '}</Text>
      {value.slice(cursorPosition + 1)}
    </Text>
  )
}

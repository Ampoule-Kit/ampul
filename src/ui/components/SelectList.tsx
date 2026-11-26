import { Box, Text, useInput } from 'ink'
import { useState } from 'react'
import { colors, symbols } from '../theme.js'
import { Description } from './Description.js'
import { KeyHints, type KeyHint } from './KeyHints.js'
import { visibleWindow } from './visibleWindow.js'

export interface SelectOption<Value> {
  value: Value
  label: string
  hint?: string
  description?: string
  tone?: 'danger'
}

interface SelectListProps<Value> {
  options: SelectOption<Value>[]
  initialValue?: Value
  onSelect: (value: Value) => void
  onCancel?: () => void
  cancelLabel?: string
  extraHints?: KeyHint[]
  maxVisible?: number
}

export function SelectList<Value>({
  options,
  initialValue,
  onSelect,
  onCancel,
  cancelLabel = 'back',
  extraHints = [],
  maxVisible = 10,
}: SelectListProps<Value>) {
  const initialIndex = Math.max(
    0,
    options.findIndex((option) => option.value === initialValue),
  )
  const [focusedIndex, setFocusedIndex] = useState(initialIndex)
  const visible = visibleWindow(options.length, focusedIndex, maxVisible)

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setFocusedIndex((index) => (index - 1 + options.length) % options.length)
    } else if (key.downArrow || input === 'j') {
      setFocusedIndex((index) => (index + 1) % options.length)
    } else if (key.home) {
      setFocusedIndex(0)
    } else if (key.end) {
      setFocusedIndex(options.length - 1)
    } else if (key.return) {
      const focused = options[focusedIndex]
      if (focused) onSelect(focused.value)
    } else if (key.escape && onCancel) {
      onCancel()
    } else if (/^[1-9]$/.test(input) && Number(input) <= options.length) {
      onSelect(options[Number(input) - 1]!.value)
    }
  })

  const focused = options[focusedIndex]
  return (
    <Box flexDirection="column">
      {visible.hasAbove && <Text color={colors.muted}>  ↑ more</Text>}
      {options.slice(visible.start, visible.end).map((option, offset) => {
        const isFocused = visible.start + offset === focusedIndex
        const color = option.tone === 'danger' ? colors.danger : isFocused ? colors.accent : undefined
        return (
          <Text key={option.label}>
            <Text color={colors.accent}>{isFocused ? symbols.pointer : ' '}</Text>{' '}
            <Text color={color} bold={isFocused}>
              {option.label}
            </Text>
            {option.hint && <Text color={colors.muted}>  {option.hint}</Text>}
          </Text>
        )
      })}
      {visible.hasBelow && <Text color={colors.muted}>  ↓ more</Text>}
      {focused?.description && <Description>{focused.description}</Description>}
      <KeyHints
        hints={[
          ['↑↓', 'move'],
          ['enter', 'choose'],
          ...extraHints,
          ...(onCancel ? ([['esc', cancelLabel]] as KeyHint[]) : []),
        ]}
      />
    </Box>
  )
}

import { Box, Text, useInput } from 'ink'
import { colorOrTerminalDefault, colors, symbols, type ThemeColor } from '../theme.ts'
import { Description } from './Description.tsx'
import { hintWhen, type KeyHint, KeyHints, noExtraHints } from './KeyHints.tsx'
import { useListNavigation } from './useListNavigation.ts'
import { visibleWindow } from './visibleWindow.ts'

export interface SelectOption<Value> {
  value: Value
  label: string
  hint?: string | undefined
  description?: string | undefined
  tone?: 'danger' | undefined
}

interface SelectListProps<Value> {
  options: SelectOption<Value>[]
  initialValue?: Value | undefined
  onSelect: (value: Value) => void
  onCancel?: (() => void) | undefined
  cancelLabel?: string
  extraHints?: KeyHint[]
  maxVisible?: number
}

const numberKeyPattern = /^[1-9]$/

function labelColor(option: SelectOption<unknown>, isFocused: boolean): ThemeColor | undefined {
  if (option.tone === 'danger') return colors.danger
  return isFocused ? colors.accent : undefined
}

export function SelectList<Value>({
  options,
  initialValue,
  onSelect,
  onCancel,
  cancelLabel = 'back',
  extraHints = noExtraHints,
  maxVisible = 10,
}: SelectListProps<Value>) {
  const initialIndex = Math.max(
    0,
    options.findIndex((option) => option.value === initialValue),
  )
  const navigation = useListNavigation(options.length, initialIndex)
  const visible = visibleWindow(options.length, navigation.focusedIndex, maxVisible)
  const focusedOption = options[navigation.focusedIndex]

  useInput((input, key) => {
    if (navigation.handleNavigationKey(input, key)) return
    if (key.return && focusedOption) {
      onSelect(focusedOption.value)
    } else if (key.escape && onCancel) {
      onCancel()
    } else if (numberKeyPattern.test(input)) {
      const numberedOption = options[Number(input) - 1]
      if (numberedOption) onSelect(numberedOption.value)
    }
  })

  return (
    <Box flexDirection="column">
      {visible.hasAbove && <Text color={colors.muted}> ↑ more</Text>}
      {options.slice(visible.start, visible.end).map((option, offset) => {
        const isFocused = visible.start + offset === navigation.focusedIndex
        return (
          <Text key={option.label}>
            <Text color={colors.accent}>{isFocused ? symbols.pointer : ' '}</Text>{' '}
            <Text {...colorOrTerminalDefault(labelColor(option, isFocused))} bold={isFocused}>
              {option.label}
            </Text>
            {option.hint && <Text color={colors.muted}> {option.hint}</Text>}
          </Text>
        )
      })}
      {visible.hasBelow && <Text color={colors.muted}> ↓ more</Text>}
      {focusedOption?.description && <Description>{focusedOption.description}</Description>}
      <KeyHints
        hints={[
          ['↑↓', 'move'],
          ['enter', 'choose'],
          ...extraHints,
          ...hintWhen(onCancel !== undefined, ['esc', cancelLabel]),
        ]}
      />
    </Box>
  )
}

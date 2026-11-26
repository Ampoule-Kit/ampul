import { Box, Text, useInput } from 'ink'
import { Fragment, useState, type ReactNode } from 'react'
import { colors, symbols } from '../theme.js'
import { Description } from './Description.js'
import { KeyHints } from './KeyHints.js'
import { visibleWindow } from './visibleWindow.js'

export interface MultiSelectOption<Value> {
  value: Value
  label: string
  hint?: string
  description?: string
  section?: string
  exclusiveGroup?: string
}

interface MultiSelectListProps<Value> {
  options: MultiSelectOption<Value>[]
  initialSelection: Value[]
  onSubmit: (selection: Value[]) => void
  onCancel?: () => void
  footer?: (selection: Value[]) => ReactNode
  requiredOptions?: (selection: Value[]) => Map<Value, string>
  maxVisible?: number
}

export function MultiSelectList<Value>({
  options,
  initialSelection,
  onSubmit,
  onCancel,
  footer,
  requiredOptions,
  maxVisible = 12,
}: MultiSelectListProps<Value>) {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [selection, setSelection] = useState<Value[]>(initialSelection)
  const [lockedNotice, setLockedNotice] = useState<string>()
  const visible = visibleWindow(options.length, focusedIndex, maxVisible)
  const required = requiredOptions?.(selection) ?? new Map<Value, string>()
  const effectiveSelection = options
    .map((option) => option.value)
    .filter((value) => selection.includes(value) || required.has(value))

  const toggle = (option: MultiSelectOption<Value>) => {
    const requiredReason = required.get(option.value)
    if (requiredReason) {
      setLockedNotice(`${option.label} stays selected: ${requiredReason}.`)
      return
    }
    setLockedNotice(undefined)
    setSelection((current) => {
      if (current.includes(option.value)) return current.filter((value) => value !== option.value)
      const othersInGroup = options
        .filter((other) => option.exclusiveGroup && other.exclusiveGroup === option.exclusiveGroup)
        .map((other) => other.value)
      return [...current.filter((value) => !othersInGroup.includes(value)), option.value]
    })
  }

  const moveFocus = (step: number) => {
    setLockedNotice(undefined)
    setFocusedIndex((index) => (index + step + options.length) % options.length)
  }

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      moveFocus(-1)
    } else if (key.downArrow || input === 'j') {
      moveFocus(1)
    } else if (input === ' ') {
      const focused = options[focusedIndex]
      if (focused) toggle(focused)
    } else if (key.return) {
      onSubmit(effectiveSelection)
    } else if (key.escape && onCancel) {
      onCancel()
    }
  })

  const focused = options[focusedIndex]
  return (
    <Box flexDirection="column">
      {visible.hasAbove && <Text color={colors.muted}> ↑ more</Text>}
      {options.slice(visible.start, visible.end).map((option, offset) => {
        const index = visible.start + offset
        const isFocused = index === focusedIndex
        const isSelected = effectiveSelection.includes(option.value)
        const requiredReason = required.get(option.value)
        const startsSection = option.section && option.section !== options[index - 1]?.section
        const mark = option.exclusiveGroup
          ? isSelected
            ? symbols.radioSelected
            : symbols.radioUnselected
          : isSelected
            ? symbols.selected
            : symbols.unselected
        return (
          <Fragment key={option.label}>
            {startsSection && (
              <Box marginTop={index === visible.start ? 0 : 1}>
                <Text color={colors.muted} bold>
                  {option.section}
                </Text>
              </Box>
            )}
            <Text>
              <Text color={colors.accent}>{isFocused ? symbols.pointer : ' '}</Text>{' '}
              <Text color={isSelected ? colors.success : colors.muted}>{mark}</Text>{' '}
              <Text color={isFocused ? colors.accent : undefined} bold={isFocused}>
                {option.label}
              </Text>
              {option.hint && <Text color={colors.muted}> {option.hint}</Text>}
              {requiredReason && <Text color={colors.muted}> · {requiredReason}</Text>}
            </Text>
          </Fragment>
        )
      })}
      {visible.hasBelow && <Text color={colors.muted}> ↓ more</Text>}
      {focused?.description && <Description>{focused.description}</Description>}
      {lockedNotice && (
        <Text color={colors.warning}>
          {symbols.warning} {lockedNotice}
        </Text>
      )}
      {footer?.(effectiveSelection)}
      <KeyHints
        hints={[
          ['↑↓', 'move'],
          ['space', 'select'],
          ['enter', `continue (${effectiveSelection.length} selected)`],
          ...(onCancel ? ([['esc', 'back']] as [string, string][]) : []),
        ]}
      />
    </Box>
  )
}

import { Box, Text, useInput } from 'ink'
import { Fragment, type ReactNode, useState } from 'react'
import { colorOrTerminalDefault, colors, symbols } from '../theme.ts'
import { Description } from './Description.tsx'
import { hintWhen, type KeyHint, KeyHints } from './KeyHints.tsx'
import { toggleSelection } from './multiSelection.ts'
import { useListNavigation } from './useListNavigation.ts'
import { visibleWindow } from './visibleWindow.ts'

export interface MultiSelectOption<Value> {
  value: Value
  label: string
  hint?: string | undefined
  description?: string | undefined
  section?: string | undefined
  exclusiveGroup?: string | undefined
}

interface MultiSelectListProps<Value> {
  options: MultiSelectOption<Value>[]
  initialSelection: Value[]
  onSubmit: (selection: Value[]) => void
  onCancel?: (() => void) | undefined
  footer?: ((selection: Value[]) => ReactNode) | undefined
  requiredOptions?: ((selection: Value[]) => Map<Value, string>) | undefined
  maxVisible?: number
}

interface MultiSelectRowProps {
  label: string
  hint: string | undefined
  requiredReason: string | undefined
  isFocused: boolean
  isSelected: boolean
  isExclusive: boolean
}

function selectionMark(isSelected: boolean, isExclusive: boolean): string {
  if (isExclusive) return isSelected ? symbols.radioSelected : symbols.radioUnselected
  return isSelected ? symbols.selected : symbols.unselected
}

function MultiSelectRow({
  label,
  hint,
  requiredReason,
  isFocused,
  isSelected,
  isExclusive,
}: MultiSelectRowProps) {
  return (
    <Text>
      <Text color={colors.accent}>{isFocused ? symbols.pointer : ' '}</Text>{' '}
      <Text color={isSelected ? colors.success : colors.muted}>
        {selectionMark(isSelected, isExclusive)}
      </Text>{' '}
      <Text {...colorOrTerminalDefault(isFocused ? colors.accent : undefined)} bold={isFocused}>
        {label}
      </Text>
      {hint && <Text color={colors.muted}> {hint}</Text>}
      {requiredReason && <Text color={colors.muted}> · {requiredReason}</Text>}
    </Text>
  )
}

function SectionHeading({ title, isFirstVisible }: { title: string; isFirstVisible: boolean }) {
  return (
    <Box marginTop={isFirstVisible ? 0 : 1}>
      <Text color={colors.muted} bold>
        {title}
      </Text>
    </Box>
  )
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
  const navigation = useListNavigation(options.length)
  const [selection, setSelection] = useState<Value[]>(initialSelection)
  const [lockedNotice, setLockedNotice] = useState<string>()
  const visible = visibleWindow(options.length, navigation.focusedIndex, maxVisible)
  const requiredReasons = requiredOptions?.(selection) ?? new Map<Value, string>()
  const effectiveSelection = options
    .map((option) => option.value)
    .filter((value) => selection.includes(value) || requiredReasons.has(value))
  const focusedOption = options[navigation.focusedIndex]

  const toggleFocusedOption = () => {
    if (!focusedOption) return
    const requiredReason = requiredReasons.get(focusedOption.value)
    if (requiredReason) {
      setLockedNotice(`${focusedOption.label} stays selected: ${requiredReason}.`)
      return
    }
    setLockedNotice(undefined)
    setSelection((current) => toggleSelection(current, focusedOption, options))
  }

  useInput((input, key) => {
    if (navigation.handleNavigationKey(input, key)) setLockedNotice(undefined)
    else if (input === ' ') toggleFocusedOption()
    else if (key.return) onSubmit(effectiveSelection)
    else if (key.escape && onCancel) onCancel()
  })

  const keyHints: KeyHint[] = [
    ['↑↓', 'move'],
    ['space', 'select'],
    ['enter', `continue (${effectiveSelection.length} selected)`],
    ...hintWhen(onCancel !== undefined, ['esc', 'back']),
  ]

  return (
    <Box flexDirection="column">
      {visible.hasAbove && <Text color={colors.muted}> ↑ more</Text>}
      {options.slice(visible.start, visible.end).map((option, offset) => {
        const index = visible.start + offset
        const startsSection =
          option.section !== undefined && option.section !== options[index - 1]?.section
        return (
          <Fragment key={option.label}>
            {startsSection && (
              <SectionHeading
                title={option.section ?? ''}
                isFirstVisible={index === visible.start}
              />
            )}
            <MultiSelectRow
              label={option.label}
              hint={option.hint}
              requiredReason={requiredReasons.get(option.value)}
              isFocused={index === navigation.focusedIndex}
              isSelected={effectiveSelection.includes(option.value)}
              isExclusive={option.exclusiveGroup !== undefined}
            />
          </Fragment>
        )
      })}
      {visible.hasBelow && <Text color={colors.muted}> ↓ more</Text>}
      {focusedOption?.description && <Description>{focusedOption.description}</Description>}
      {lockedNotice && (
        <Text color={colors.warning}>
          {symbols.warning} {lockedNotice}
        </Text>
      )}
      {footer?.(effectiveSelection)}
      <KeyHints hints={keyHints} />
    </Box>
  )
}

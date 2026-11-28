import { Box, Text, useInput } from 'ink'
import { Fragment, type ReactNode, useState } from 'react'
import { colorOrTerminalDefault, colors, symbols } from '../theme.ts'
import { Description } from './Description.tsx'
import { hintWhen, type KeyHint, KeyHints } from './KeyHints.tsx'
import { toggleSelection } from './multiSelection.ts'
import { labelColumnWidth, useListHeight } from './useListHeight.ts'
import { useListNavigation } from './useListNavigation.ts'
import { visibleWindow } from './visibleWindow.ts'

export interface MultiSelectOption<Value> {
  value: Value
  label: string
  hint?: string | undefined
  description?: string | undefined
  section?: string | undefined
  exclusiveWith?: Value[] | undefined
}

interface MultiSelectListProps<Value> {
  options: MultiSelectOption<Value>[]
  initialSelection: Value[]
  onSubmit: (selection: Value[]) => void
  onCancel?: (() => void) | undefined
  footer?: ((selection: Value[]) => ReactNode) | undefined
  requiredOptions?: ((selection: Value[]) => Map<Value, string>) | undefined
  selectionProblem?: ((selection: Value[]) => string | undefined) | undefined
  maxVisible?: number
}

interface MultiSelectRowProps {
  label: string
  labelWidth: number
  hint: string | undefined
  requiredReason: string | undefined
  isFocused: boolean
  isSelected: boolean
  isExclusive: boolean
}

// The question, the answers above it, the description and the key hints around the list.
const reservedListRows = 22
const mostListRows = 24

function selectionMark(isSelected: boolean, isExclusive: boolean): string {
  if (isExclusive) return isSelected ? symbols.radioSelected : symbols.radioUnselected
  return isSelected ? symbols.selected : symbols.unselected
}

function MultiSelectRow({
  label,
  labelWidth,
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
        {hint || requiredReason ? label.padEnd(labelWidth) : label}
      </Text>
      {hint && <Text color={colors.muted}>{hint}</Text>}
      {requiredReason && (
        <Text color={colors.muted} dimColor>
          {hint ? '  ' : ''}
          {symbols.arrow} {requiredReason}
        </Text>
      )}
    </Text>
  )
}

export function SectionHeading({
  title,
  isFirstVisible,
}: {
  title: string
  isFirstVisible: boolean
}) {
  return (
    <Box marginTop={isFirstVisible ? 0 : 1}>
      <Text color={colors.accent} bold>
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
  selectionProblem,
  maxVisible,
}: MultiSelectListProps<Value>) {
  const listHeight = useListHeight(reservedListRows, mostListRows)
  const labelWidth = labelColumnWidth(options.map((option) => option.label))
  const navigation = useListNavigation(options.length)
  const [selection, setSelection] = useState<Value[]>(initialSelection)
  const [lockedNotice, setLockedNotice] = useState<string>()
  const visible = visibleWindow(options.length, navigation.focusedIndex, maxVisible ?? listHeight)
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
    const toggled = toggleSelection(selection, focusedOption)
    const problem = selectionProblem?.(toggled)
    setLockedNotice(problem === undefined ? undefined : `${problem}.`)
    if (problem === undefined) setSelection(toggled)
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
          <Fragment key={String(index)}>
            {startsSection && (
              <SectionHeading
                title={option.section ?? ''}
                isFirstVisible={index === visible.start}
              />
            )}
            <MultiSelectRow
              label={option.label}
              labelWidth={labelWidth}
              hint={option.hint}
              requiredReason={requiredReasons.get(option.value)}
              isFocused={index === navigation.focusedIndex}
              isSelected={effectiveSelection.includes(option.value)}
              isExclusive={(option.exclusiveWith ?? []).length > 0}
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

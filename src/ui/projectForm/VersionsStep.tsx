import { Box, Text, useInput } from 'ink'
import { Fragment, useState } from 'react'
import type {
  ModuleCatalog,
  ModuleDefinition,
  ModuleVersionDefinition,
} from '../../modules/ModuleDefinition.ts'
import { moduleCatalog } from '../../modules/moduleCatalog.ts'
import {
  describeVersionChoices,
  type ModuleSelection,
  requiringVersionLabels,
  selectedModules,
  selectionOf,
  withRequiredModules,
} from '../../modules/moduleSelection.ts'
import { joinInProse } from '../../text/prose.ts'
import { Description } from '../components/Description.tsx'
import { type KeyHint, KeyHints } from '../components/KeyHints.tsx'
import { SectionHeading } from '../components/MultiSelectList.tsx'
import { Question } from '../components/Question.tsx'
import { labelColumnWidth, useListHeight } from '../components/useListHeight.ts'
import { useListNavigation } from '../components/useListNavigation.ts'
import { visibleWindow } from '../components/visibleWindow.ts'
import type { StepControls } from '../components/Wizard.tsx'
import { colorOrTerminalDefault, colors, symbols } from '../theme.ts'
import type { ProjectDraft } from './ProjectDraft.ts'

type ChosenVersions = Record<string, string[]>

interface VersionRow {
  module: ModuleDefinition
  version: ModuleVersionDefinition
  section: string
  label: string
  isSelected: boolean
  lockedReason: string | undefined
}

const oneVersionSection = 'One version each'
// The question, the answers above it, the description and the key hints around the list.
const reservedListRows = 24
const mostListRows = 30

export function hasVersionsToChoose(selection: ModuleSelection, catalog: ModuleCatalog): boolean {
  return selectedModules(selection, catalog).some((module) => module.versions.length > 1)
}

export function versionsAreChosen(draft: ProjectDraft): boolean {
  const catalog = moduleCatalog()
  return selectedModules(draft, catalog).every(
    (module) => !module.hasVersionChoice || draft.moduleVersions[module.id] !== undefined,
  )
}

export function chosenVersions(selection: ModuleSelection, catalog: ModuleCatalog): ChosenVersions {
  return withRequiredModules(selection, catalog).moduleVersions
}

function lockedReason(
  module: ModuleDefinition,
  version: ModuleVersionDefinition,
  selection: ModuleSelection,
  catalog: ModuleCatalog,
): string | undefined {
  if (module.versions.length === 1) return 'the only version'
  const requiredBy = requiringVersionLabels(selection, catalog, module.id, version.id)
  return requiredBy.length > 0 ? `needed by ${joinInProse(requiredBy)}` : undefined
}

// Tools with versions to pick come first, each under its own heading. The tools with one
// version follow together, a row each.
function versionRows(selection: ModuleSelection, catalog: ModuleCatalog): VersionRow[] {
  const chosen = chosenVersions(selection, catalog)
  const modules = selectedModules(selection, catalog)
  const rowsOf = (module: ModuleDefinition, hasChoice: boolean) =>
    module.versions.map((version) => ({
      module,
      version,
      section: hasChoice ? module.label : oneVersionSection,
      label: hasChoice ? version.label : module.label,
      isSelected: module.hasVersionChoice ? (chosen[module.id] ?? []).includes(version.id) : true,
      lockedReason: lockedReason(module, version, selection, catalog),
    }))
  return [
    ...modules.filter((module) => module.versions.length > 1).flatMap((m) => rowsOf(m, true)),
    ...modules.filter((module) => module.versions.length === 1).flatMap((m) => rowsOf(m, false)),
  ]
}

function rowHint(row: VersionRow): string | undefined {
  const exact = row.section === oneVersionSection ? row.version.label : row.version.version
  return exact && exact !== row.label ? exact : undefined
}

function toggledVersions(
  versions: ChosenVersions,
  row: VersionRow,
): { versions: ChosenVersions; problem?: string } {
  const { module, version } = row
  const current = versions[module.id] ?? []
  if (!module.multipleVersions) return { versions: { ...versions, [module.id]: [version.id] } }
  if (!row.isSelected) {
    return { versions: { ...versions, [module.id]: [...current, version.id] } }
  }
  const remaining = current.filter((id) => id !== version.id)
  if (remaining.length === 0) {
    return { versions, problem: `Keep at least one version of ${module.label}` }
  }
  return { versions: { ...versions, [module.id]: remaining } }
}

function sameRow(first: VersionRow, second: VersionRow): boolean {
  return first.module.id === second.module.id && first.version.id === second.version.id
}

function selectionMark(row: VersionRow): string {
  if (row.module.multipleVersions) return row.isSelected ? symbols.selected : symbols.unselected
  return row.isSelected ? symbols.radioSelected : symbols.radioUnselected
}

interface VersionRowViewProps {
  row: VersionRow
  isFocused: boolean
  labelWidth: number
}

function VersionRowView({ row, isFocused, labelWidth }: VersionRowViewProps) {
  const hint = rowHint(row)
  const shownReason = row.section === oneVersionSection ? undefined : row.lockedReason
  const isLocked = row.lockedReason !== undefined
  return (
    <Text>
      <Text color={colors.accent}>{isFocused ? symbols.pointer : ' '}</Text>{' '}
      <Text color={row.isSelected ? colors.success : colors.muted} dimColor={isLocked}>
        {selectionMark(row)}
      </Text>{' '}
      <Text {...colorOrTerminalDefault(isFocused ? colors.accent : undefined)} bold={isFocused}>
        {hint || shownReason ? row.label.padEnd(labelWidth) : row.label}
      </Text>
      {hint && <Text color={colors.muted}>{hint}</Text>}
      {shownReason && (
        <Text color={colors.muted} dimColor>
          {hint ? '  ' : ''}
          {symbols.arrow} {shownReason}
        </Text>
      )}
    </Text>
  )
}

function rowDescription(row: VersionRow): string {
  if (row.module.multipleVersions) {
    return `${row.module.label} versions install side by side, so pick every one you need.`
  }
  if (row.module.versions.length > 1) return `Pick one version of ${row.module.label}.`
  return `${row.module.label} comes in one version, so it is picked for you.`
}

function versionsExplanation(catalog: ModuleCatalog): string {
  const sideBySide = catalog.modules
    .filter((module) => module.multipleVersions)
    .map((module) => module.label)
  const exception =
    sideBySide.length > 0
      ? ` Pick as many versions of ${joinInProse(sideBySide)} as you need: they install side by side.`
      : ''
  return `The newest version of each tool is picked to start with. Each tool takes one version.${exception}`
}

export function VersionsStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  const catalog = moduleCatalog()
  const [versions, setVersions] = useState<ChosenVersions>(() => chosenVersions(draft, catalog))
  const [notice, setNotice] = useState<string>()
  const selection = selectionOf(draft.modules, versions)
  const rows = versionRows(selection, catalog)
  const navigation = useListNavigation(rows.length)
  const focusedIndex = Math.min(navigation.focusedIndex, rows.length - 1)
  const focusedRow = rows[focusedIndex]
  const listHeight = useListHeight(reservedListRows, mostListRows)
  const visible = visibleWindow(rows.length, focusedIndex, listHeight)
  const labelWidth = labelColumnWidth(rows.map((row) => row.label))

  const toggleFocusedRow = () => {
    if (!focusedRow) return
    if (focusedRow.lockedReason) {
      const name =
        focusedRow.section === oneVersionSection
          ? `${focusedRow.module.label} ${focusedRow.version.label}`
          : `${focusedRow.module.label} ${focusedRow.label}`
      setNotice(`${name} stays selected: ${focusedRow.lockedReason}.`)
      return
    }
    const toggled = toggledVersions(versions, focusedRow)
    setNotice(toggled.problem && `${toggled.problem}.`)
    setVersions(toggled.versions)
    // Rows above can come or go, as a version brings or drops a requirement: stay on this one.
    const nextRows = versionRows(selectionOf(draft.modules, toggled.versions), catalog)
    navigation.focus(
      Math.max(
        0,
        nextRows.findIndex((row) => sameRow(row, focusedRow)),
      ),
    )
  }

  useInput((input, key) => {
    if (navigation.handleNavigationKey(input, key)) setNotice(undefined)
    else if (input === ' ') toggleFocusedRow()
    else if (key.return) submit({ moduleVersions: chosenVersions(selection, catalog) })
    else if (key.escape) back()
  })

  const keyHints: KeyHint[] = [
    ['↑↓', 'move'],
    ['space', 'select'],
    ['enter', 'continue'],
    ['esc', 'back'],
  ]

  return (
    <Question title="Which versions should they have?" explanation={versionsExplanation(catalog)}>
      <Box flexDirection="column">
        {visible.hasAbove && <Text color={colors.muted}> ↑ more</Text>}
        {rows.slice(visible.start, visible.end).map((row, offset) => {
          const index = visible.start + offset
          const startsSection = row.section !== rows[index - 1]?.section
          return (
            <Fragment key={`${row.module.id}@${row.version.id}`}>
              {startsSection && (
                <SectionHeading title={row.section} isFirstVisible={index === visible.start} />
              )}
              <VersionRowView
                row={row}
                isFocused={index === focusedIndex}
                labelWidth={labelWidth}
              />
            </Fragment>
          )
        })}
        {visible.hasBelow && <Text color={colors.muted}> ↓ more</Text>}
        {focusedRow && <Description>{rowDescription(focusedRow)}</Description>}
        {notice && (
          <Text color={colors.warning}>
            {symbols.warning} {notice}
          </Text>
        )}
        <KeyHints hints={keyHints} />
      </Box>
    </Question>
  )
}

export function describeVersionsAnswer(draft: ProjectDraft): string {
  return describeVersionChoices(draft, moduleCatalog()) || 'One version of each tool'
}

import { Box, Text } from 'ink'
import { useState } from 'react'
import { presetRanges } from '../../projects/portPresets.js'
import {
  combinePorts,
  formatPortList,
  formatPortRange,
  parsePortEntry,
  portsInRange,
  tooManyPortsProblem,
  type PortRange,
} from '../../projects/ports.js'
import { pluralize } from '../formatting.js'
import { KeyHints } from '../components/KeyHints.js'
import { Question } from '../components/Question.js'
import { TextField } from '../components/TextField.js'
import type { StepControls } from '../components/Wizard.js'
import { colors, symbols } from '../theme.js'
import { PortWarnings } from './PortWarnings.js'
import type { ProjectDraft } from './ProjectDraft.js'

function describeRange(range: PortRange): string {
  const count = portsInRange(range).length
  return count === 1
    ? `localhost:${range.first}`
    : `localhost:${formatPortRange(range)}, ${pluralize(count, 'port')}`
}

export function OtherPortsStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  const [ranges, setRanges] = useState(draft.otherPortRanges)
  const [entry, setEntry] = useState('')
  const [problem, setProblem] = useState<string>()
  const chosenRanges = presetRanges(draft.portPresetIds)

  const add = (enteredText: string) => {
    if (!enteredText.trim()) {
      if (ranges.length === 0) {
        return setProblem('Add a port or a range, or press esc and unselect other ports.')
      }
      return submit({ otherPortRanges: ranges })
    }
    const parsed = parsePortEntry(enteredText, [...chosenRanges, ...ranges])
    if (parsed.problem !== undefined) return setProblem(parsed.problem)
    if (parsed.ranges.length === 0) return setEntry('')
    const tooMany = tooManyPortsProblem(
      combinePorts([...chosenRanges, ...ranges, ...parsed.ranges]),
    )
    if (tooMany) return setProblem(tooMany)
    setRanges([...ranges, ...parsed.ranges])
    setEntry('')
    setProblem(undefined)
  }

  const typedRanges = entry.trim() ? parsePortEntry(entry, [...chosenRanges, ...ranges]) : undefined
  const allPorts = combinePorts([...chosenRanges, ...ranges])

  return (
    <Question
      title="Which other ports?"
      explanation="Type a port like 8081 or a range like 3000-3009 and press enter to add it. Several at once work too: 3000-3009 8000-8005. Press enter on an empty line when the list is complete."
    >
      {chosenRanges.length > 0 && (
        <Text color={colors.muted}>
          Already picked: {formatPortList(combinePorts(chosenRanges))}
        </Text>
      )}
      {ranges.map((range) => (
        <Text key={formatPortRange(range)}>
          <Text color={colors.success}>{symbols.success}</Text> {formatPortRange(range)}
          <Text color={colors.muted}>
            {'  '}
            {symbols.arrow} {describeRange(range)}
          </Text>
        </Text>
      ))}
      <Box>
        <Text color={colors.accent}>{symbols.prompt} </Text>
        <TextField
          value={entry}
          onChange={(value) => {
            setEntry(value)
            setProblem(undefined)
          }}
          onSubmit={add}
          onCancel={back}
          onBackspaceWhenEmpty={() => setRanges(ranges.slice(0, -1))}
          placeholder={
            ranges.length === 0 ? '3000-3009' : 'another port or range, or enter to continue'
          }
        />
      </Box>
      {problem && (
        <Text color={colors.danger}>
          {symbols.failure} {problem}
        </Text>
      )}
      {!problem &&
        typedRanges &&
        typedRanges.problem === undefined &&
        typedRanges.ranges.length > 0 && (
          <Text color={colors.muted}>
            Adds {pluralize(combinePorts(typedRanges.ranges).length, 'port')}:{' '}
            {typedRanges.ranges.map(formatPortRange).join(', ')}
          </Text>
        )}
      <PortWarnings ports={allPorts} projectName={draft.name} />
      <KeyHints
        hints={[
          ['enter', ranges.length > 0 && !entry ? 'continue' : 'add'],
          ['backspace', 'remove last'],
          ['esc', 'back'],
        ]}
      />
    </Question>
  )
}

export function describeOtherPorts(draft: ProjectDraft): string {
  return draft.otherPortRanges.map(formatPortRange).join(', ')
}

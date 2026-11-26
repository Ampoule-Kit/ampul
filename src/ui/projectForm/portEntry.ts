import {
  combinePorts,
  type PortRange,
  parsePortEntry,
  tooManyPortsProblem,
} from '../../projects/ports.ts'
import type { ListEntryOutcome } from './listEntryOutcome.ts'

export function evaluatePortEntry(
  enteredText: string,
  chosenRanges: PortRange[],
  addedRanges: PortRange[],
): ListEntryOutcome<PortRange> {
  if (!enteredText.trim()) {
    return addedRanges.length > 0
      ? { kind: 'finish' }
      : {
          kind: 'problem',
          message: 'Add a port or a range, or press esc and unselect other ports.',
        }
  }
  const parsed = parsePortEntry(enteredText, [...chosenRanges, ...addedRanges])
  if (parsed.problem !== undefined) return { kind: 'problem', message: parsed.problem }
  if (parsed.ranges.length === 0) return { kind: 'nothing' }
  const allPorts = combinePorts([...chosenRanges, ...addedRanges, ...parsed.ranges])
  const tooMany = tooManyPortsProblem(allPorts)
  if (tooMany) return { kind: 'problem', message: tooMany }
  return { kind: 'add', items: parsed.ranges }
}

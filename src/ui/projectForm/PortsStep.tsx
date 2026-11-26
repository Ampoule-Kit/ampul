import { Box, Text } from 'ink'
import { parsePorts } from '../../projects/ports.js'
import { Question } from '../components/Question.js'
import { TextPrompt } from '../components/TextPrompt.js'
import type { StepControls } from '../components/Wizard.js'
import { colors, symbols } from '../theme.js'
import type { ProjectDraft } from './ProjectDraft.js'

function PortsPreview({ text }: { text: string }) {
  const parsed = parsePorts(text)
  if (parsed.problem !== undefined || parsed.ports.length === 0) {
    return (
      <Text color={colors.muted}>
        No ports: nothing in the container is reachable from this machine.
      </Text>
    )
  }
  return (
    <Box flexDirection="column">
      {parsed.ports.map((port) => (
        <Text key={port} color={colors.muted}>
          localhost:{port} {symbols.arrow} port {port} in the container
        </Text>
      ))}
    </Box>
  )
}

export function PortsStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  return (
    <Question
      title="Which ports should this machine reach?"
      explanation="The ports your apps listen on, for example 4200 5000. Apps can keep listening on localhost inside the container; devenv forwards each port for you."
    >
      <TextPrompt
        initialValue={draft.ports.join(' ')}
        placeholder="none"
        validate={(text) => parsePorts(text).problem}
        preview={(text) => <PortsPreview text={text} />}
        onSubmit={(text) => {
          const parsed = parsePorts(text)
          if (parsed.problem === undefined) submit({ ports: parsed.ports })
        }}
        onCancel={back}
      />
    </Question>
  )
}

export function describePortsAnswer(draft: ProjectDraft): string {
  return draft.ports.length > 0 ? draft.ports.join(', ') : 'None'
}

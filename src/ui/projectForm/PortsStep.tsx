import { Box, Text } from 'ink'
import { portPresets, presetRanges } from '../../projects/portPresets.ts'
import { combinePorts, formatPortList, formatPortRange } from '../../projects/ports.ts'
import { MultiSelectList, type MultiSelectOption } from '../components/MultiSelectList.tsx'
import { Question } from '../components/Question.tsx'
import type { StepControls } from '../components/Wizard.tsx'
import { colors } from '../theme.ts'
import { PortWarnings } from './PortWarnings.tsx'
import type { ProjectDraft } from './ProjectDraft.ts'

const otherPortsValue = 'other'

const portOptions: MultiSelectOption<string>[] = [
  ...portPresets.map((preset) => ({
    value: preset.id,
    label: preset.label,
    hint: formatPortRange(preset.range),
    section: preset.section,
    description: preset.description,
  })),
  {
    value: otherPortsValue,
    label: 'Other ports and ranges',
    section: 'Your own',
    description:
      'Add any ports or ranges on the next screen, such as 8081 or 3000-3009, as many as you need.',
  },
]

function selectedPorts(values: string[], draft: ProjectDraft): number[] {
  const otherRanges = values.includes(otherPortsValue) ? draft.otherPortRanges : []
  return combinePorts([...presetRanges(values), ...otherRanges])
}

function SelectionPreview({ values, draft }: { values: string[]; draft: ProjectDraft }) {
  const ports = selectedPorts(values, draft)
  const addsOtherPorts = values.includes(otherPortsValue)
  return (
    <Box flexDirection="column" marginTop={1}>
      {ports.length > 0 ? (
        <Text color={colors.muted}>
          Forwards {formatPortList(ports)} from this machine into the container
          {addsOtherPorts ? ', plus what you add next' : ''}.
        </Text>
      ) : (
        <Text color={colors.muted}>
          {addsOtherPorts
            ? 'You add the ports on the next screen.'
            : 'No ports: nothing in the container is reachable from this machine.'}
        </Text>
      )}
      <PortWarnings ports={ports} projectName={draft.name} />
    </Box>
  )
}

export function PortsStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  const initialSelection = [
    ...draft.portPresetIds,
    ...(draft.addsOtherPorts ? [otherPortsValue] : []),
  ]
  return (
    <Question
      title="Which ports should this machine reach?"
      explanation="Pick the ports your apps listen on. Apps can keep listening on localhost inside the container; ampul forwards each port to localhost on this machine."
    >
      <MultiSelectList
        options={portOptions}
        initialSelection={initialSelection}
        onSubmit={(values) =>
          submit({
            portPresetIds: values.filter((value) => value !== otherPortsValue),
            addsOtherPorts: values.includes(otherPortsValue),
          })
        }
        onCancel={back}
        footer={(values) => <SelectionPreview values={values} draft={draft} />}
      />
    </Question>
  )
}

export function describePortsAnswer(draft: ProjectDraft): string {
  const presetPorts = combinePorts(presetRanges(draft.portPresetIds))
  if (presetPorts.length === 0) return draft.addsOtherPorts ? 'Your own' : 'None'
  return formatPortList(presetPorts) + (draft.addsOtherPorts ? ', and your own' : '')
}

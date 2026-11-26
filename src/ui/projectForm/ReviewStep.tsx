import { Box, Text } from 'ink'
import { useState } from 'react'
import { usesInnerContainerEngine } from '../../containers/containerCreation.js'
import { imageName } from '../../containers/naming.js'
import { describeCodeSource } from '../../projects/codeSources.js'
import { describePorts, describeTools } from '../../projects/projectSummary.js'
import type { ProjectSettings } from '../../projects/ProjectSettings.js'
import { pluralize } from '../formatting.js'
import { Question } from '../components/Question.js'
import { SelectList, type SelectOption } from '../components/SelectList.js'
import type { StepControls } from '../components/Wizard.js'
import { colors, symbols } from '../theme.js'
import { settingsFromDraft, type ProjectDraft } from './ProjectDraft.js'

export type ProjectFormAction = 'create' | 'save' | 'save-and-rebuild'

export interface ReviewContext {
  mode: 'new' | 'config'
  runtimeDescription: string
  originalSettings?: ProjectSettings
  editableSteps: { id: string; title: string }[]
  onAction: (action: ProjectFormAction, draft: ProjectDraft) => void
}

type ReviewChoice = ProjectFormAction | 'change' | 'cancel'

function SummaryRow({
  label,
  value,
  changed,
}: {
  label: string
  value: string
  changed?: boolean
}) {
  return (
    <Box>
      <Box width={10}>
        <Text color={colors.muted}>{label}</Text>
      </Box>
      <Text color={changed ? colors.warning : undefined}>
        {value}
        {changed ? '  (changed)' : ''}
      </Text>
    </Box>
  )
}

function plannedSteps(project: ProjectSettings): string[] {
  const source = project.codeSource
  return [
    `Build the image ${imageName(project.name)}. The first build downloads every tool and takes a few minutes; later builds reuse the cache.`,
    project.ports.length > 0
      ? `Create the container and forward ${pluralize(project.ports.length, 'port')} to this machine.`
      : 'Create the container.',
    'Copy your dotfiles in, then set up Neovim plugins and language servers, git and SSH.',
    source.kind === 'repositories'
      ? `Clone ${pluralize(source.repositories.length, 'repository', 'repositories')} into ~/Project.`
      : 'Copy the folder into ~/Project.',
  ]
}

function reviewChoices(mode: ReviewContext['mode']): SelectOption<ReviewChoice>[] {
  if (mode === 'new') {
    return [
      { value: 'create', label: 'Create the project' },
      { value: 'change', label: 'Change an answer' },
      { value: 'cancel', label: 'Cancel', tone: 'danger' },
    ]
  }
  return [
    {
      value: 'save-and-rebuild',
      label: 'Save and rebuild now',
      description:
        'Recreates the container with the new settings. Unpushed work in ~/Project is lost.',
    },
    {
      value: 'save',
      label: 'Save, rebuild later',
      description:
        'The changes apply the next time you run dev rebuild. The container keeps running as it is.',
    },
    { value: 'change', label: 'Change an answer' },
    { value: 'cancel', label: 'Discard the changes', tone: 'danger' },
  ]
}

function hasChanged(
  original: ProjectSettings | undefined,
  describe: (project: ProjectSettings) => string,
  current: ProjectSettings,
) {
  return original !== undefined && describe(original) !== describe(current)
}

export function ReviewStep({
  draft,
  jumpTo,
  cancel,
  context,
}: StepControls<ProjectDraft> & { context: ReviewContext }) {
  const [choosingAnswer, setChoosingAnswer] = useState(false)
  const project = settingsFromDraft(draft)
  const original = context.originalSettings
  const codeSourceText = (settings: ProjectSettings) => describeCodeSource(settings.codeSource)
  const portsText = (settings: ProjectSettings) => describePorts(settings.ports)

  if (choosingAnswer) {
    return (
      <Question title="Which answer do you want to change?">
        <SelectList
          options={context.editableSteps.map((step) => ({ value: step.id, label: step.title }))}
          onSelect={jumpTo}
          onCancel={() => setChoosingAnswer(false)}
        />
      </Question>
    )
  }

  return (
    <Question
      title={
        context.mode === 'new'
          ? `Ready to create ${project.name}`
          : `Save the changes to ${project.name}?`
      }
    >
      <Box flexDirection="column">
        <SummaryRow
          label="Code"
          value={codeSourceText(project)}
          changed={hasChanged(original, codeSourceText, project)}
        />
        <SummaryRow
          label="Tools"
          value={describeTools(project)}
          changed={hasChanged(original, describeTools, project)}
        />
        <SummaryRow
          label="Ports"
          value={portsText(project)}
          changed={hasChanged(original, portsText, project)}
        />
        <SummaryRow label="Runtime" value={context.runtimeDescription} />
      </Box>
      {context.mode === 'new' && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>What happens next</Text>
          {plannedSteps(project).map((step, index) => (
            <Text key={step}>
              <Text color={colors.accent}>{index + 1}.</Text> {step}
            </Text>
          ))}
        </Box>
      )}
      {usesInnerContainerEngine(project) && (
        <Box marginTop={1}>
          <Text color={colors.warning}>
            {symbols.warning} The container engine inside the project needs the container to run
            privileged.
          </Text>
        </Box>
      )}
      <Box marginTop={1} flexDirection="column">
        <SelectList<ReviewChoice>
          options={reviewChoices(context.mode)}
          onSelect={(choice) => {
            if (choice === 'change') return setChoosingAnswer(true)
            if (choice === 'cancel') return cancel()
            context.onAction(choice, draft)
          }}
          onCancel={() => setChoosingAnswer(true)}
          cancelLabel="change an answer"
        />
      </Box>
    </Question>
  )
}

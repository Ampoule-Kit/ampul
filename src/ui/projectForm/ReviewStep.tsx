import { Box, Text } from 'ink'
import { useState } from 'react'
import { imageName } from '../../containers/naming.ts'
import { moduleCatalog } from '../../modules/moduleCatalog.ts'
import { installationOrder, privilegedModuleLabels } from '../../modules/moduleSelection.ts'
import { describeCodeSource } from '../../projects/codeSources.ts'
import type { CodeSource, ProjectSettings } from '../../projects/ProjectSettings.ts'
import { describePorts, describeTools } from '../../projects/projectSummary.ts'
import { joinInProse, pluralize } from '../../text/prose.ts'
import { Question } from '../components/Question.tsx'
import { SelectList, type SelectOption } from '../components/SelectList.tsx'
import type { StepControls } from '../components/Wizard.tsx'
import { colorOrTerminalDefault, colors, symbols } from '../theme.ts'
import { type ProjectDraft, settingsFromDraft } from './ProjectDraft.ts'

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
      <Text {...colorOrTerminalDefault(changed ? colors.warning : undefined)}>
        {value}
        {changed ? '  (changed)' : ''}
      </Text>
    </Box>
  )
}

function setupStepDescription(project: ProjectSettings): string {
  const toolsWithSetup = installationOrder(project.modules, moduleCatalog())
    .filter((module) => module.hasSetup)
    .map((module) => module.label)
  const toolSetup = toolsWithSetup.length > 0 ? `, then set up ${joinInProse(toolsWithSetup)}` : ''
  return `Link your dotfiles, and your git and SSH config${toolSetup}.`
}

function codeStepDescription(source: CodeSource): string {
  if (source.kind === 'repositories') {
    return `Clone ${pluralize(source.repositories.length, 'repository', 'repositories')} into ~/home.`
  }
  if (source.kind === 'folders') {
    return `Mount ${pluralize(source.folders.length, 'folder')} from this machine into ~/home.`
  }
  return 'Mount your home folder from this machine at ~/home.'
}

function plannedSteps(project: ProjectSettings): string[] {
  return [
    `Build the image ${imageName(project.name)}. The first build downloads every tool and takes a few minutes; later builds reuse the cache.`,
    project.ports.length > 0
      ? `Create the container and forward ${pluralize(project.ports.length, 'port')} to this machine.`
      : 'Create the container.',
    setupStepDescription(project),
    codeStepDescription(project.codeSource),
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
        'Recreates the container with the new settings. Unpushed work in cloned repositories is lost.',
    },
    {
      value: 'save',
      label: 'Save, rebuild later',
      description:
        'The changes apply the next time you run ampul rebuild. The container keeps running as it is.',
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

function codeSourceText(settings: ProjectSettings): string {
  return describeCodeSource(settings.codeSource)
}

function portsText(settings: ProjectSettings): string {
  return describePorts(settings.ports)
}

export function ReviewStep({
  draft,
  jumpTo,
  cancel,
  context,
}: StepControls<ProjectDraft> & { context: ReviewContext }) {
  const [choosingAnswer, setChoosingAnswer] = useState(false)
  const project = settingsFromDraft(draft)
  const privilegedLabels = privilegedModuleLabels(project.modules, moduleCatalog())
  const original = context.originalSettings

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
            <Box key={step}>
              <Box width={3} flexShrink={0}>
                <Text color={colors.accent}>{index + 1}.</Text>
              </Box>
              <Text>{step}</Text>
            </Box>
          ))}
        </Box>
      )}
      {privilegedLabels.length > 0 && (
        <Box marginTop={1}>
          <Text color={colors.warning}>
            {symbols.warning} {joinInProse(privilegedLabels)}{' '}
            {privilegedLabels.length === 1 ? 'needs' : 'need'} the container to run privileged.
          </Text>
        </Box>
      )}
      <Box marginTop={1} flexDirection="column">
        <SelectList<ReviewChoice>
          options={reviewChoices(context.mode)}
          onSelect={(choice) => {
            if (choice === 'change') setChoosingAnswer(true)
            else if (choice === 'cancel') cancel()
            else context.onAction(choice, draft)
          }}
          onCancel={() => setChoosingAnswer(true)}
          cancelLabel="change an answer"
        />
      </Box>
    </Question>
  )
}

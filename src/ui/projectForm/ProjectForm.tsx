import { Box } from 'ink'
import { isGitRepositoryRoot } from '../../system/folders.js'
import { Header } from '../components/Header.js'
import { answeredSteps, Wizard, type WizardStep } from '../components/Wizard.js'
import type { Finish } from '../terminal.js'
import { CodeSourceStep, describeCodeSourceKind } from './CodeSourceStep.js'
import { describeFolder, FolderStep } from './FolderStep.js'
import { describeModulesAnswer, ModulesStep } from './ModulesStep.js'
import { describeGitFiles, GitFilesStep } from './GitFilesStep.js'
import { NameStep } from './NameStep.js'
import { describeOtherPorts, OtherPortsStep } from './OtherPortsStep.js'
import { describePortsAnswer, PortsStep } from './PortsStep.js'
import type { ProjectDraft } from './ProjectDraft.js'
import { describeRepositories, RepositoriesStep } from './RepositoriesStep.js'
import { ReviewStep, type ProjectFormAction, type ReviewContext } from './ReviewStep.js'

export interface ProjectFormResult {
  action: ProjectFormAction
  draft: ProjectDraft
}

interface ProjectFormProps {
  initialDraft: ProjectDraft
  askForName: boolean
  review: Pick<ReviewContext, 'mode' | 'runtimeDescription' | 'originalSettings'>
  finish: Finish<ProjectFormResult | undefined>
}

const stepsOfferedForChanges = new Set(['code', 'name', 'tools', 'ports', 'other-ports'])

function questionSteps(askForName: boolean): WizardStep<ProjectDraft>[] {
  return [
    {
      id: 'code',
      title: 'Code',
      summary: describeCodeSourceKind,
      render: (controls) => <CodeSourceStep {...controls} />,
    },
    {
      id: 'repositories',
      title: 'Repositories',
      isSkipped: (draft) => draft.codeSourceKind !== 'repositories',
      isComplete: (draft) => draft.repositories.length > 0,
      summary: describeRepositories,
      render: (controls) => <RepositoriesStep {...controls} />,
    },
    {
      id: 'folder',
      title: 'Folder',
      isSkipped: (draft) => draft.codeSourceKind !== 'folder',
      isComplete: (draft) => Boolean(draft.folder),
      summary: describeFolder,
      render: (controls) => <FolderStep {...controls} />,
    },
    {
      id: 'git-files',
      title: 'Copy',
      isSkipped: (draft) =>
        draft.codeSourceKind !== 'folder' || !draft.folder || !isGitRepositoryRoot(draft.folder),
      summary: describeGitFiles,
      render: (controls) => <GitFilesStep {...controls} />,
    },
    {
      id: 'name',
      title: 'Name',
      isSkipped: () => !askForName,
      isComplete: (draft) => Boolean(draft.name),
      summary: (draft) => draft.name,
      render: (controls) => <NameStep {...controls} />,
    },
    {
      id: 'tools',
      title: 'Tools',
      summary: describeModulesAnswer,
      render: (controls) => <ModulesStep {...controls} />,
    },
    {
      id: 'ports',
      title: 'Ports',
      summary: describePortsAnswer,
      render: (controls) => <PortsStep {...controls} />,
    },
    {
      id: 'other-ports',
      title: 'Other ports',
      isSkipped: (draft) => !draft.addsOtherPorts,
      isComplete: (draft) => draft.otherPortRanges.length > 0,
      summary: describeOtherPorts,
      render: (controls) => <OtherPortsStep {...controls} />,
    },
  ]
}

export function ProjectForm({ initialDraft, askForName, review, finish }: ProjectFormProps) {
  const questions = questionSteps(askForName)
  const reviewContext: ReviewContext = {
    ...review,
    editableSteps: questions
      .filter((step) => stepsOfferedForChanges.has(step.id) && !step.isSkipped?.(initialDraft))
      .map((step) => ({ id: step.id, title: step.title })),
    onAction: (action, draft) => finish({ action, draft }),
  }
  const reviewStep: WizardStep<ProjectDraft> = {
    id: 'review',
    title: 'Review',
    render: (controls) => <ReviewStep {...controls} context={reviewContext} />,
  }

  return (
    <Box flexDirection="column">
      <Header
        title={review.mode === 'new' ? 'New project' : `Configure ${initialDraft.name}`}
        subtitle={
          review.mode === 'new'
            ? 'Esc goes back a step. Ctrl+C quits without changing anything.'
            : 'Pick what to change. Ctrl+C quits without changing anything.'
        }
      />
      <Wizard
        steps={[...questions, reviewStep]}
        initialDraft={initialDraft}
        initialStepId={review.mode === 'config' ? reviewStep.id : undefined}
        onFinish={(draft) => finish({ action: review.mode === 'new' ? 'create' : 'save', draft })}
        onCancel={() => finish(undefined)}
      />
    </Box>
  )
}

export function ProjectFormSummary({
  draft,
  askForName,
}: {
  draft: ProjectDraft
  askForName: boolean
}) {
  return <Box flexDirection="column">{answeredSteps(questionSteps(askForName), draft)}</Box>
}

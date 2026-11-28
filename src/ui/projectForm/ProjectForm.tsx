import { Box } from 'ink'
import { moduleCatalog } from '../../modules/moduleCatalog.ts'
import { Header } from '../components/Header.tsx'
import { answeredSteps, Wizard, type WizardStep } from '../components/Wizard.tsx'
import type { Finish } from '../terminal.tsx'
import { CodeSourceStep, describeCodeSourceKind } from './CodeSourceStep.tsx'
import { describeFolders, FoldersStep } from './FoldersStep.tsx'
import { describeModulesAnswer, ModulesStep } from './ModulesStep.tsx'
import { NameStep } from './NameStep.tsx'
import type { ProjectDraft } from './ProjectDraft.ts'
import { describeRepositories, RepositoriesStep } from './RepositoriesStep.tsx'
import { type ProjectFormAction, type ReviewContext, ReviewStep } from './ReviewStep.tsx'
import {
  describeVersionsAnswer,
  hasVersionsToChoose,
  VersionsStep,
  versionsAreChosen,
} from './VersionsStep.tsx'

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

const stepsOfferedForChanges = new Set(['code', 'name', 'tools', 'versions'])

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
      id: 'folders',
      title: 'Folders',
      isSkipped: (draft) => draft.codeSourceKind !== 'folders',
      isComplete: (draft) => draft.folders.length > 0,
      summary: describeFolders,
      render: (controls) => <FoldersStep {...controls} />,
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
      id: 'versions',
      title: 'Versions',
      isSkipped: (draft) => !hasVersionsToChoose(draft, moduleCatalog()),
      isComplete: versionsAreChosen,
      summary: describeVersionsAnswer,
      render: (controls) => <VersionsStep {...controls} />,
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

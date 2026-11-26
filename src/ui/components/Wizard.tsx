import { Box } from 'ink'
import { type ReactNode, useState } from 'react'
import { AnsweredQuestion } from './Question.tsx'
import { firstActiveStepIndex, type NavigableStep, nextStepIndex } from './wizardNavigation.ts'

export interface StepControls<Draft> {
  draft: Draft
  submit: (changes: Partial<Draft>) => void
  back: () => void
  jumpTo: (stepId: string) => void
  finish: () => void
  cancel: () => void
}

export interface WizardStep<Draft> extends NavigableStep<Draft> {
  title: string
  summary?: ((draft: Draft) => string) | undefined
  render: (controls: StepControls<Draft>) => ReactNode
}

interface WizardProps<Draft> {
  steps: WizardStep<Draft>[]
  initialDraft: Draft
  initialStepId?: string | undefined
  onFinish: (draft: Draft) => void
  onCancel: () => void
}

interface Detour {
  jumpedToStepId: string
  returnToStepId: string
}

export function answeredSteps<Draft>(
  steps: WizardStep<Draft>[],
  draft: Draft,
  beforeIndex = steps.length,
) {
  return steps.slice(0, beforeIndex).flatMap((step) => {
    if (!step.summary || step.isSkipped?.(draft)) return []
    return [<AnsweredQuestion key={step.id} title={step.title} answer={step.summary(draft)} />]
  })
}

export function Wizard<Draft>({
  steps,
  initialDraft,
  initialStepId,
  onFinish,
  onCancel,
}: WizardProps<Draft>) {
  const indexOf = (stepId: string) => steps.findIndex((candidate) => candidate.id === stepId)
  const [draft, setDraft] = useState(initialDraft)
  const [stepIndex, setStepIndex] = useState(() =>
    initialStepId === undefined
      ? firstActiveStepIndex(steps, initialDraft, 0, 1)
      : indexOf(initialStepId),
  )
  const [detour, setDetour] = useState<Detour>()

  const currentStep = steps[stepIndex]
  if (!currentStep) return null

  const endDetour = (returnToStepId: string) => {
    setDetour(undefined)
    setStepIndex(indexOf(returnToStepId))
  }

  const controls: StepControls<Draft> = {
    draft,
    submit: (changes) => {
      const nextDraft = { ...draft, ...changes }
      const nextIndex = nextStepIndex(steps, nextDraft, stepIndex, detour?.returnToStepId)
      if (nextIndex >= steps.length) {
        onFinish(nextDraft)
        return
      }
      setDraft(nextDraft)
      if (detour && nextIndex === indexOf(detour.returnToStepId)) endDetour(detour.returnToStepId)
      else setStepIndex(nextIndex)
    },
    back: () => {
      if (detour?.jumpedToStepId === currentStep.id) {
        endDetour(detour.returnToStepId)
        return
      }
      const previousIndex = firstActiveStepIndex(steps, draft, stepIndex - 1, -1)
      if (previousIndex < 0) onCancel()
      else setStepIndex(previousIndex)
    },
    jumpTo: (stepId) => {
      setDetour({ jumpedToStepId: stepId, returnToStepId: currentStep.id })
      setStepIndex(indexOf(stepId))
    },
    finish: () => onFinish(draft),
    cancel: onCancel,
  }

  return (
    <Box flexDirection="column">
      {answeredSteps(steps, draft, stepIndex)}
      <Box key={currentStep.id} flexDirection="column">
        {currentStep.render(controls)}
      </Box>
    </Box>
  )
}

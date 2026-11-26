import { Box } from 'ink'
import { useState, type ReactNode } from 'react'
import { AnsweredQuestion } from './Question.js'

export interface StepControls<Draft> {
  draft: Draft
  submit: (changes: Partial<Draft>) => void
  back: () => void
  jumpTo: (stepId: string) => void
  finish: () => void
  cancel: () => void
}

export interface WizardStep<Draft> {
  id: string
  title: string
  isSkipped?: (draft: Draft) => boolean
  isComplete?: (draft: Draft) => boolean
  summary?: (draft: Draft) => string
  render: (controls: StepControls<Draft>) => ReactNode
}

interface WizardProps<Draft> {
  steps: WizardStep<Draft>[]
  initialDraft: Draft
  initialStepId?: string
  onFinish: (draft: Draft) => void
  onCancel: () => void
}

export function answeredSteps<Draft>(
  steps: WizardStep<Draft>[],
  draft: Draft,
  beforeIndex = steps.length,
) {
  return steps
    .slice(0, beforeIndex)
    .filter((step) => step.summary && !step.isSkipped?.(draft))
    .map((step) => (
      <AnsweredQuestion key={step.id} title={step.title} answer={step.summary!(draft)} />
    ))
}

interface Detour {
  jumpedToStepId: string
  returnToStepId: string
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
    initialStepId ? indexOf(initialStepId) : firstActiveIndex(steps, initialDraft, 0, 1),
  )
  const [detour, setDetour] = useState<Detour>()

  const endDetour = (stepId: string) => {
    setDetour(undefined)
    setStepIndex(indexOf(stepId))
  }

  const step = steps[stepIndex]!
  const controls: StepControls<Draft> = {
    draft,
    submit: (changes) => {
      const nextDraft = { ...draft, ...changes }
      const nextIndex = nextStepIndex(steps, nextDraft, stepIndex, detour?.returnToStepId)
      if (nextIndex >= steps.length) return onFinish(nextDraft)
      setDraft(nextDraft)
      if (detour && nextIndex === indexOf(detour.returnToStepId))
        return endDetour(detour.returnToStepId)
      setStepIndex(nextIndex)
    },
    back: () => {
      if (detour?.jumpedToStepId === step.id) return endDetour(detour.returnToStepId)
      const previous = firstActiveIndex(steps, draft, stepIndex - 1, -1)
      if (previous < 0) return onCancel()
      setStepIndex(previous)
    },
    jumpTo: (stepId) => {
      setDetour({ jumpedToStepId: stepId, returnToStepId: step.id })
      setStepIndex(indexOf(stepId))
    },
    finish: () => onFinish(draft),
    cancel: onCancel,
  }

  return (
    <Box flexDirection="column">
      {answeredSteps(steps, draft, stepIndex)}
      <Box key={step.id} flexDirection="column">
        {step.render(controls)}
      </Box>
    </Box>
  )
}

function firstActiveIndex<Draft>(
  steps: WizardStep<Draft>[],
  draft: Draft,
  from: number,
  direction: 1 | -1,
) {
  let index = from
  while (index >= 0 && index < steps.length && steps[index]!.isSkipped?.(draft)) index += direction
  return index
}

function nextStepIndex<Draft>(
  steps: WizardStep<Draft>[],
  draft: Draft,
  currentIndex: number,
  returnToStepId: string | undefined,
): number {
  let index = firstActiveIndex(steps, draft, currentIndex + 1, 1)
  if (!returnToStepId) return index
  const returnIndex = steps.findIndex((step) => step.id === returnToStepId)
  while (index < returnIndex && (steps[index]!.isComplete?.(draft) ?? true)) {
    index = firstActiveIndex(steps, draft, index + 1, 1)
  }
  return index
}

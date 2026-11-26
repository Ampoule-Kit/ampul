export interface NavigableStep<Draft> {
  id: string
  isSkipped?: ((draft: Draft) => boolean) | undefined
  isComplete?: ((draft: Draft) => boolean) | undefined
}

export type StepDirection = 1 | -1

export function firstActiveStepIndex<Draft>(
  steps: readonly NavigableStep<Draft>[],
  draft: Draft,
  startIndex: number,
  direction: StepDirection,
): number {
  const isSkipped = (index: number) => steps[index]?.isSkipped?.(draft) ?? false
  let index = startIndex
  while (isSkipped(index)) index += direction
  return index
}

export function nextStepIndex<Draft>(
  steps: readonly NavigableStep<Draft>[],
  draft: Draft,
  currentIndex: number,
  returnToStepId: string | undefined,
): number {
  let index = firstActiveStepIndex(steps, draft, currentIndex + 1, 1)
  if (returnToStepId === undefined) return index
  const returnIndex = steps.findIndex((step) => step.id === returnToStepId)
  const isAnswered = (stepIndex: number) => steps[stepIndex]?.isComplete?.(draft) ?? true
  while (index < returnIndex && isAnswered(index)) {
    index = firstActiveStepIndex(steps, draft, index + 1, 1)
  }
  return index
}

export interface VisibleWindow {
  start: number
  end: number
  hasAbove: boolean
  hasBelow: boolean
}

export function visibleWindow(
  itemCount: number,
  focusedIndex: number,
  maxVisible: number,
): VisibleWindow {
  if (itemCount <= maxVisible) {
    return { start: 0, end: itemCount, hasAbove: false, hasBelow: false }
  }
  const halfWindow = Math.floor(maxVisible / 2)
  const start = Math.min(Math.max(0, focusedIndex - halfWindow), itemCount - maxVisible)
  const end = start + maxVisible
  return { start, end, hasAbove: start > 0, hasBelow: end < itemCount }
}

import type { Key } from 'ink'
import { useState } from 'react'

export interface ListNavigation {
  focusedIndex: number
  handleNavigationKey: (input: string, key: Key) => boolean
  focus: (index: number) => void
}

export function useListNavigation(itemCount: number, initialIndex = 0): ListNavigation {
  const [focusedIndex, setFocusedIndex] = useState(initialIndex)
  const moveFocusBy = (step: number) =>
    setFocusedIndex((index) => (index + step + itemCount) % itemCount)

  const handleNavigationKey = (input: string, key: Key): boolean => {
    if (key.upArrow || input === 'k') moveFocusBy(-1)
    else if (key.downArrow || input === 'j') moveFocusBy(1)
    else if (key.home) setFocusedIndex(0)
    else if (key.end) setFocusedIndex(itemCount - 1)
    else return false
    return true
  }

  return { focusedIndex, handleNavigationKey, focus: setFocusedIndex }
}

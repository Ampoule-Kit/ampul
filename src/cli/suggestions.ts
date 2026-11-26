const maximumSuggestionDistance = 2

function editDistance(first: string, second: string): number {
  let previousRow = Array.from({ length: second.length + 1 }, (_, column) => column)
  for (const [rowIndex, firstCharacter] of Array.from(first).entries()) {
    const currentRow = [rowIndex + 1]
    for (const [columnIndex, secondCharacter] of Array.from(second).entries()) {
      const substitutionCost = firstCharacter === secondCharacter ? 0 : 1
      const deletion = (previousRow[columnIndex + 1] ?? 0) + 1
      const insertion = (currentRow[columnIndex] ?? 0) + 1
      const substitution = (previousRow[columnIndex] ?? 0) + substitutionCost
      currentRow.push(Math.min(deletion, insertion, substitution))
    }
    previousRow = currentRow
  }
  return previousRow.at(-1) ?? 0
}

export function closestMatch(input: string, candidates: string[]): string | undefined {
  let closest: { candidate: string; distance: number } | undefined
  for (const candidate of candidates) {
    const distance = editDistance(input, candidate)
    if (distance <= maximumSuggestionDistance && (!closest || distance < closest.distance)) {
      closest = { candidate, distance }
    }
  }
  return closest?.candidate
}

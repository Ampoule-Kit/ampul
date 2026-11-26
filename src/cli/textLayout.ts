import chalk from 'chalk'

export const indent = '    '
const maximumWidth = 100
const narrowestWrapWidth = 20
const definitionGap = 3

export function pageWidth(): number {
  return Math.min(process.stdout.columns || maximumWidth, maximumWidth)
}

export function wrap(text: string, leadingSpace: string, width = pageWidth()): string[] {
  const available = Math.max(narrowestWrapWidth, width - leadingSpace.length)
  const lines: string[] = []
  let currentLine = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (currentLine && currentLine.length + 1 + word.length > available) {
      lines.push(leadingSpace + currentLine)
      currentLine = word
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word
    }
  }
  if (currentLine) lines.push(leadingSpace + currentLine)
  return lines
}

export function paragraphs(texts: string[]): string[] {
  return texts.flatMap((text, index) => [...(index > 0 ? [''] : []), ...wrap(text, indent)])
}

export function definitionList(entries: [term: string, definition: string][]): string[] {
  const termWidth = Math.max(...entries.map(([term]) => term.length)) + definitionGap
  return entries.flatMap(([term, definition]) => {
    const [firstLine = '', ...remainingLines] = wrap(definition, indent + ' '.repeat(termWidth))
    return [
      indent + chalk.bold(term) + firstLine.slice(indent.length + term.length),
      ...remainingLines,
    ]
  })
}

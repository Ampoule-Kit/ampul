import readline from 'node:readline'

const lineReader = readline.createInterface({ input: process.stdin, terminal: false })
const answeredLines = lineReader[Symbol.asyncIterator]()
const yesAnswer = /^y(es)?$/i

export function closePrompts(): void {
  process.stdin.destroy()
}

export async function ask(question: string, defaultAnswer = ''): Promise<string> {
  const suffix = defaultAnswer ? ` [${defaultAnswer}]` : ''
  process.stdout.write(`${question}${suffix}: `)
  const nextLine = await answeredLines.next()
  if (nextLine.done === true) throw new Error('The input ended before every question was answered.')
  return nextLine.value.trim() || defaultAnswer
}

export async function askUntilValid(
  question: string,
  problemWith: (answer: string) => string | undefined,
  defaultAnswer = '',
): Promise<string> {
  for (;;) {
    const answer = await ask(question, defaultAnswer)
    const problem = answer ? problemWith(answer) : 'An answer is required.'
    if (problem === undefined) return answer
    console.log(`  ${problem}`)
  }
}

export async function askYesOrNo(question: string, defaultAnswer: boolean): Promise<boolean> {
  return yesAnswer.test(await ask(`${question} (y/n)`, defaultAnswer ? 'y' : 'n'))
}

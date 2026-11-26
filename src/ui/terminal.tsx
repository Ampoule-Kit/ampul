import { render, renderToString, useApp, useInput } from 'ink'
import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { UserCancelled } from '../problems/Problem.js'

export type Finish<Result> = (result: Result) => void

interface InteractiveScreenProps<Result> {
  screen: (finish: Finish<Result>) => ReactNode
  summary?: (result: Result) => ReactNode
}

const defaultTerminalWidth = 100

export function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY) && !process.env.CI
}

export function terminalWidth(): number {
  return process.stdout.columns || defaultTerminalWidth
}

function InteractiveScreen<Result>({ screen, summary }: InteractiveScreenProps<Result>) {
  const { exit } = useApp()
  const [answer, setAnswer] = useState<{ result: Result }>()

  useInput((input, key) => {
    if (key.ctrl && input === 'c') exit(new UserCancelled())
  })

  useEffect(() => {
    if (answer) exit(answer.result)
  }, [answer, exit])

  if (answer) return summary ? <>{summary(answer.result)}</> : null
  return <>{screen((result) => setAnswer({ result }))}</>
}

export async function showInteractiveScreen<Result>(
  screen: (finish: Finish<Result>) => ReactNode,
  summary?: (result: Result) => ReactNode,
): Promise<Result> {
  const instance = render(<InteractiveScreen screen={screen} summary={summary} />, {
    exitOnCtrlC: false,
  })
  return (await instance.waitUntilExit()) as Result
}

export function printElement(element: ReactElement): void {
  process.stdout.write(renderToString(element, { columns: terminalWidth() }) + '\n')
}

export function printErrorElement(element: ReactElement): void {
  process.stderr.write(renderToString(element, { columns: terminalWidth() }) + '\n')
}

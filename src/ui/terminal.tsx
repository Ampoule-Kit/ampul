import { render, renderToString, useApp, useInput } from 'ink'
import { type ReactElement, type ReactNode, useEffect, useState } from 'react'
import { UserCancelled } from '../problems/UserCancelled.ts'
import { isEnvironmentFlagSet } from '../system/environment.ts'

export type Finish<Result> = (result: Result) => void

type ScreenOutcome<Result> = { status: 'answered'; result: Result } | { status: 'cancelled' }

interface InteractiveScreenProps<Result> {
  screen: (finish: Finish<Result>) => ReactNode
  summary?: ((result: Result) => ReactNode) | undefined
  onSettled: (outcome: ScreenOutcome<Result>) => void
}

const defaultTerminalWidth = 100

export function isInteractiveTerminal(): boolean {
  return process.stdin.isTTY && process.stdout.isTTY && !isEnvironmentFlagSet('CI')
}

function terminalWidth(): number {
  return process.stdout.columns || defaultTerminalWidth
}

function InteractiveScreen<Result>({ screen, summary, onSettled }: InteractiveScreenProps<Result>) {
  const { exit } = useApp()
  const [answer, setAnswer] = useState<{ result: Result }>()

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      onSettled({ status: 'cancelled' })
      exit()
    }
  })

  useEffect(() => {
    if (!answer) return
    onSettled({ status: 'answered', result: answer.result })
    exit()
  }, [answer, exit, onSettled])

  if (answer) return summary ? summary(answer.result) : null
  return screen((result) => {
    setAnswer({ result })
  })
}

export async function showInteractiveScreen<Result>(
  screen: (finish: Finish<Result>) => ReactNode,
  summary?: (result: Result) => ReactNode,
): Promise<Result> {
  const latest: { outcome: ScreenOutcome<Result> } = { outcome: { status: 'cancelled' } }
  const recordOutcome = (settled: ScreenOutcome<Result>) => {
    latest.outcome = settled
  }
  const instance = render(
    <InteractiveScreen screen={screen} summary={summary} onSettled={recordOutcome} />,
    { exitOnCtrlC: false },
  )
  await instance.waitUntilExit()
  if (latest.outcome.status === 'cancelled') throw new UserCancelled()
  return latest.outcome.result
}

export function printElement(element: ReactElement): void {
  process.stdout.write(renderToString(element, { columns: terminalWidth() }) + '\n')
}

export function printErrorElement(element: ReactElement): void {
  process.stderr.write(renderToString(element, { columns: terminalWidth() }) + '\n')
}

import chalk from 'chalk'
import { render, Text, useInput } from 'ink'
import { stopRunningProcesses } from '../system/processes.ts'
import type { LogFile } from '../tasks/LogFile.ts'
import {
  type Task,
  type TaskObserver,
  TaskRunner,
  type TaskRunResult,
} from '../tasks/TaskRunner.ts'
import { TaskProgressView } from './components/TaskProgressView.tsx'
import { isInteractiveTerminal, printElement } from './terminal.tsx'
import { colors, symbols } from './theme.ts'

const interruptedExitCode = 130

const plainOutputObserver: TaskObserver = {
  taskStarted: (title) => {
    process.stdout.write(chalk.bold(`==> ${title}\n`))
  },
  outputLine: (line) => {
    process.stdout.write(`${line}\n`)
  },
  warning: (message) => {
    process.stderr.write(chalk.yellow(`${symbols.warning} ${message}\n`))
  },
}

function interrupt(logFile: LogFile): never {
  stopRunningProcesses()
  printElement(
    <Text color={colors.warning}>
      {symbols.warning} Stopped before finishing. Run the same command again to finish the job. The
      log is in {logFile.path}
    </Text>,
  )
  process.exit(interruptedExitCode)
}

function InterruptibleProgress({ runner, logFile }: { runner: TaskRunner; logFile: LogFile }) {
  useInput((input, key) => {
    if (key.ctrl && input === 'c') interrupt(logFile)
  })
  return <TaskProgressView runner={runner} />
}

export async function runTasks(tasks: Task[], logFile: LogFile): Promise<TaskRunResult> {
  if (!isInteractiveTerminal()) return new TaskRunner(tasks, logFile, plainOutputObserver).run()

  const runner = new TaskRunner(tasks, logFile)
  const instance = render(<InterruptibleProgress runner={runner} logFile={logFile} />, {
    exitOnCtrlC: false,
  })
  const result = await runner.run()
  await instance.waitUntilRenderFlush()
  instance.unmount()
  await instance.waitUntilExit()
  return result
}

import { render } from 'ink'
import chalk from 'chalk'
import type { LogFile } from '../tasks/LogFile.js'
import { TaskRunner, type Task, type TaskObserver, type TaskRunResult } from '../tasks/TaskRunner.js'
import { TaskProgressView } from './components/TaskProgressView.js'
import { isInteractiveTerminal } from './terminal.js'
import { symbols } from './theme.js'

const plainOutputObserver: TaskObserver = {
  taskStarted: (title) => process.stdout.write(chalk.bold(`==> ${title}\n`)),
  outputLine: (line) => process.stdout.write(`${line}\n`),
  warning: (message) => process.stderr.write(chalk.yellow(`${symbols.warning} ${message}\n`)),
}

export async function runTasks(tasks: Task[], logFile: LogFile): Promise<TaskRunResult> {
  if (!isInteractiveTerminal()) return new TaskRunner(tasks, logFile, plainOutputObserver).run()

  const runner = new TaskRunner(tasks, logFile)
  const instance = render(<TaskProgressView runner={runner} />, { exitOnCtrlC: true })
  const result = await runner.run()
  await instance.waitUntilRenderFlush()
  instance.unmount()
  await instance.waitUntilExit()
  return result
}

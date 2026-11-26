import { asProblem, Problem } from '../problems/Problem.ts'
import type { LogFile } from './LogFile.ts'

export interface TaskContext {
  output: (chunk: string) => void
  outputLine: (line: string) => void
  detail: (text: string | undefined) => void
  progress: (completed: number, total: number) => void
  warn: (message: string) => void
}

export interface Task {
  title: string
  run: (context: TaskContext) => Promise<void> | void
}

export type TaskStatus = 'pending' | 'running' | 'succeeded' | 'failed'

export interface TaskProgress {
  completed: number
  total: number
}

export interface TaskState {
  title: string
  status: TaskStatus
  detail: string | undefined
  progress: TaskProgress | undefined
  recentOutput: string[]
  startedAt: number | undefined
  finishedAt: number | undefined
}

export type TaskRunResult =
  | { succeeded: true; warnings: string[]; logFile: string }
  | { succeeded: false; problem: Problem; warnings: string[]; logFile: string }

export interface TaskRunSnapshot {
  tasks: TaskState[]
  warnings: string[]
}

type SnapshotListener = (snapshot: TaskRunSnapshot) => void

export interface TaskObserver {
  taskStarted?: (title: string) => void
  outputLine?: (line: string) => void
  warning?: (message: string) => void
}

const recentOutputLimit = 200
const failureOutputLines = 20

function pendingState(task: Task): TaskState {
  return {
    title: task.title,
    status: 'pending',
    detail: undefined,
    progress: undefined,
    recentOutput: [],
    startedAt: undefined,
    finishedAt: undefined,
  }
}

export class TaskRunner {
  private readonly tasks: Task[]
  private readonly logFile: LogFile
  private readonly observer: TaskObserver
  private readonly states: TaskState[]
  private readonly warnings: string[] = []
  private readonly listeners = new Set<SnapshotListener>()

  constructor(tasks: Task[], logFile: LogFile, observer: TaskObserver = {}) {
    this.tasks = tasks
    this.logFile = logFile
    this.observer = observer
    this.states = tasks.map(pendingState)
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  snapshot(): TaskRunSnapshot {
    return {
      tasks: this.states.map((state) => ({ ...state, recentOutput: [...state.recentOutput] })),
      warnings: [...this.warnings],
    }
  }

  async run(): Promise<TaskRunResult> {
    for (const [index, task] of this.tasks.entries()) {
      const state = this.states[index]
      if (!state) continue
      this.update(state, { status: 'running', startedAt: Date.now() })
      this.logFile.heading(task.title)
      this.observer.taskStarted?.(task.title)
      try {
        await task.run(this.contextFor(state))
        this.update(state, { status: 'succeeded', finishedAt: Date.now(), detail: undefined })
      } catch (error) {
        this.update(state, { status: 'failed', finishedAt: Date.now() })
        const problem = this.failureProblem(error, state)
        this.logFile.write(`\nFAILED: ${problem.title}\n${problem.explanation ?? ''}\n`)
        return { succeeded: false, problem, warnings: this.warnings, logFile: this.logFile.path }
      }
    }
    return { succeeded: true, warnings: this.warnings, logFile: this.logFile.path }
  }

  private contextFor(state: TaskState): TaskContext {
    const appendLine = (line: string) => {
      const trimmed = line.trimEnd()
      if (!trimmed) return
      this.observer.outputLine?.(trimmed)
      state.recentOutput.push(trimmed)
      if (state.recentOutput.length > recentOutputLimit) state.recentOutput.shift()
      this.publish()
    }
    return {
      output: (chunk) => {
        this.logFile.write(chunk)
      },
      outputLine: appendLine,
      detail: (text) => this.update(state, { detail: text }),
      progress: (completed, total) => this.update(state, { progress: { completed, total } }),
      warn: (message) => {
        this.warnings.push(message)
        this.observer.warning?.(message)
        this.logFile.write(`WARNING: ${message}\n`)
        this.publish()
      },
    }
  }

  private failureProblem(error: unknown, state: TaskState): Problem {
    const problem = asProblem(error)
    const outputTail =
      problem.outputTail.length > 0
        ? problem.outputTail
        : state.recentOutput.slice(-failureOutputLines)
    return new Problem(problem.title, {
      explanation: problem.explanation,
      fixes: problem.fixes,
      outputTail,
      logFile: this.logFile.path,
    })
  }

  private update(state: TaskState, changes: Partial<TaskState>): void {
    Object.assign(state, changes)
    this.publish()
  }

  private publish(): void {
    const snapshot = this.snapshot()
    for (const listener of this.listeners) listener(snapshot)
  }
}

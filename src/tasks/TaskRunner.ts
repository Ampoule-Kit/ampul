import { asProblem, Problem } from '../problems/Problem.js'
import type { LogFile } from './LogFile.js'

export interface TaskContext {
  output(chunk: string): void
  outputLine(line: string): void
  detail(text: string | undefined): void
  progress(completed: number, total: number): void
  warn(message: string): void
}

export interface Task {
  title: string
  run(context: TaskContext): Promise<void>
}

export type TaskStatus = 'pending' | 'running' | 'succeeded' | 'failed'

export interface TaskState {
  title: string
  status: TaskStatus
  detail?: string
  progress?: { completed: number; total: number }
  recentOutput: string[]
  startedAt?: number
  finishedAt?: number
}

export interface TaskRunResult {
  succeeded: boolean
  problem?: Problem
  warnings: string[]
  logFile: string
}

export interface TaskRunSnapshot {
  tasks: TaskState[]
  warnings: string[]
}

type Listener = (snapshot: TaskRunSnapshot) => void

export interface TaskObserver {
  taskStarted?(title: string): void
  outputLine?(line: string): void
  warning?(message: string): void
}

const recentOutputLimit = 200
const failureOutputLines = 20

export class TaskRunner {
  private readonly states: TaskState[]
  private readonly warnings: string[] = []
  private readonly listeners = new Set<Listener>()

  constructor(
    private readonly tasks: Task[],
    private readonly logFile: LogFile,
    private readonly observer: TaskObserver = {},
  ) {
    this.states = tasks.map((task) => ({ title: task.title, status: 'pending', recentOutput: [] }))
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => this.listeners.delete(listener)
  }

  snapshot(): TaskRunSnapshot {
    return {
      tasks: this.states.map((state) => ({ ...state, recentOutput: [...state.recentOutput] })),
      warnings: [...this.warnings],
    }
  }

  async run(): Promise<TaskRunResult> {
    for (const [index, task] of this.tasks.entries()) {
      const state = this.states[index]!
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
      output: (chunk) => this.logFile.write(chunk),
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

import { spawn, type ChildProcess } from 'node:child_process'
import type { Readable } from 'node:stream'

export interface CapturedOutput {
  exitCode: number
  stdout: string
  stderr: string
}

export interface ProcessOptions {
  input?: string | Buffer | Readable
  environment?: Record<string, string>
  workingDirectory?: string
  timeoutMilliseconds?: number
}

export interface StreamingOptions extends ProcessOptions {
  onOutput?: (chunk: string) => void
  onLine?: (line: string) => void
}

const commandNotFoundExitCode = 127

function startProcess(
  executable: string,
  args: string[],
  options: ProcessOptions,
  stdio: 'pipe' | 'inherit',
): ChildProcess {
  return spawn(executable, args, {
    cwd: options.workingDirectory,
    env: { ...process.env, ...options.environment },
    stdio: stdio === 'inherit' ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    timeout: options.timeoutMilliseconds,
    windowsHide: true,
  })
}

function feedInput(child: ChildProcess, input: ProcessOptions['input']): void {
  if (!child.stdin) return
  child.stdin.on('error', () => {})
  if (input === undefined) {
    child.stdin.end()
  } else if (typeof input === 'string' || Buffer.isBuffer(input)) {
    child.stdin.end(input)
  } else {
    input.pipe(child.stdin)
  }
}

function waitForExit(
  child: ChildProcess,
  onStartFailure: (message: string) => void,
): Promise<number> {
  return new Promise((resolve) => {
    child.on('error', (error: NodeJS.ErrnoException) => {
      onStartFailure(
        error.code === 'ENOENT' ? `${child.spawnfile}: command not found` : error.message,
      )
      resolve(commandNotFoundExitCode)
    })
    child.on('close', (exitCode, signal) => resolve(exitCode ?? (signal ? 128 : 1)))
  })
}

export async function captureCommand(
  executable: string,
  args: string[],
  options: ProcessOptions = {},
): Promise<CapturedOutput> {
  const child = startProcess(executable, args, options, 'pipe')
  let stdout = ''
  let stderr = ''
  child.stdout?.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk))
  child.stderr?.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk))
  feedInput(child, options.input)
  const exitCode = await waitForExit(child, (message) => (stderr += message))
  return { exitCode, stdout, stderr }
}

export async function streamCommand(
  executable: string,
  args: string[],
  options: StreamingOptions = {},
): Promise<number> {
  const child = startProcess(executable, args, options, 'pipe')
  const lines = new LineSplitter((line) => options.onLine?.(line))
  const receive = (chunk: string) => {
    options.onOutput?.(chunk)
    lines.push(chunk)
  }
  child.stdout?.setEncoding('utf8').on('data', receive)
  child.stderr?.setEncoding('utf8').on('data', receive)
  feedInput(child, options.input)
  const exitCode = await waitForExit(child, (message) => receive(message + '\n'))
  lines.flush()
  return exitCode
}

export async function runAttachedToTerminal(
  executable: string,
  args: string[],
  options: ProcessOptions = {},
): Promise<number> {
  const child = startProcess(executable, args, options, 'inherit')
  return waitForExit(child, (message) => process.stderr.write(message + '\n'))
}

export class LineSplitter {
  private pending = ''

  constructor(private readonly onLine: (line: string) => void) {}

  push(chunk: string): void {
    const pieces = (this.pending + chunk).split(/\r\n|\n|\r/)
    this.pending = pieces.pop() ?? ''
    for (const piece of pieces) this.onLine(piece)
  }

  flush(): void {
    if (this.pending) this.onLine(this.pending)
    this.pending = ''
  }
}

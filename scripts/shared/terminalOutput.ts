import { spawn } from 'node:child_process'
import { environmentVariable } from '../../src/system/environment.ts'
import { isWindows } from './repository.ts'

export interface Fix {
  description: string
  command?: string
}

export interface StepFailure {
  title?: string
  explanation?: string
  fixes?: Fix[]
}

const usesColor = process.stdout.isTTY && environmentVariable('NO_COLOR') === undefined
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const spinnerIntervalMilliseconds = 80
const failureOutputLines = 25
const millisecondsPerSecond = 1000
const clearToEndOfLine = '\u001B[K'

function paint(ansiCode: string, text: string): string {
  return usesColor ? `\u001B[${ansiCode}m${text}\u001B[0m` : text
}

export const style = {
  bold: (text: string) => paint('1', text),
  muted: (text: string) => paint('90', text),
  accent: (text: string) => paint('36', text),
  success: (text: string) => paint('32', text),
  warning: (text: string) => paint('33', text),
  danger: (text: string) => paint('31', text),
}

export function heading(text: string): void {
  console.log(`\n${paint('46;30;1', ' devenv ')} ${style.bold(text)}\n`)
}

export function success(text: string): void {
  console.log(`${style.success('✔')} ${text}`)
}

export function note(text: string): void {
  console.log(`${style.accent('ℹ')} ${text}`)
}

export function fail(title: string, explanation?: string, fixes: Fix[] = []): never {
  console.error(`\n${style.danger(style.bold(`✖ ${title}`))}`)
  if (explanation) console.error(`  ${explanation}`)
  if (fixes.length > 0) {
    console.error(`\n  ${style.bold('How to fix it')}`)
    for (const fix of fixes) {
      console.error(`   ${style.accent('→')} ${fix.description}`)
      if (fix.command) console.error(`     ${style.accent(`$ ${fix.command}`)}`)
    }
  }
  console.error('')
  process.exit(1)
}

function formatSeconds(milliseconds: number): string {
  return `${Math.round(milliseconds / millisecondsPerSecond)}s`
}

function startSpinner(title: string, startedAt: number): () => void {
  if (!process.stdout.isTTY) {
    console.log(`… ${title}`)
    return () => {}
  }
  let frameIndex = 0
  const timer = setInterval(() => {
    frameIndex = (frameIndex + 1) % spinnerFrames.length
    const elapsed = style.muted(formatSeconds(Date.now() - startedAt))
    const frame = style.accent(spinnerFrames[frameIndex] ?? '')
    process.stdout.write(`\r${frame} ${title} ${elapsed}${clearToEndOfLine}`)
  }, spinnerIntervalMilliseconds)
  return () => {
    clearInterval(timer)
    process.stdout.write(`\r${clearToEndOfLine}`)
  }
}

export function runStep(
  title: string,
  executable: string,
  commandArguments: string[],
  workingDirectory: string,
  failure: StepFailure = {},
): Promise<string> {
  const startedAt = Date.now()
  const stopSpinner = startSpinner(title, startedAt)
  return new Promise((resolve) => {
    const child = spawn(executable, commandArguments, {
      cwd: workingDirectory,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindows,
    })
    let output = ''
    const collect = (chunk: Buffer) => {
      output += chunk.toString()
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    const finish = (exitCode: number | null) => {
      stopSpinner()
      if (exitCode === 0) {
        success(`${title} ${style.muted(formatSeconds(Date.now() - startedAt))}`)
        resolve(output)
        return
      }
      console.error(`${style.danger('✖')} ${title}`)
      for (const line of output.trim().split('\n').slice(-failureOutputLines)) {
        console.error(style.muted(`  │ ${line}`))
      }
      fail(failure.title ?? `${title} failed`, failure.explanation, failure.fixes)
    }
    child.on('error', (error) => {
      output += error.message
      finish(1)
    })
    child.on('close', finish)
  })
}

import { spawn } from 'node:child_process'

const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const failureOutputLines = 25

function paint(code, text) {
  return useColor ? `\x1b[${code}m${text}\x1b[0m` : text
}

export const style = {
  bold: (text) => paint('1', text),
  muted: (text) => paint('90', text),
  accent: (text) => paint('36', text),
  success: (text) => paint('32', text),
  warning: (text) => paint('33', text),
  danger: (text) => paint('31', text),
}

export function heading(text) {
  console.log(`\n${paint('46;30;1', ' devenv ')} ${style.bold(text)}\n`)
}

export function success(text) {
  console.log(`${style.success('✔')} ${text}`)
}

export function note(text) {
  console.log(`${style.accent('ℹ')} ${text}`)
}

export function fail(title, explanation, fixes = []) {
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

function formatSeconds(milliseconds) {
  return `${Math.round(milliseconds / 1000)}s`
}

export function runStep(title, executable, args, options = {}) {
  const startedAt = Date.now()
  let frame = 0
  const timer = process.stdout.isTTY
    ? setInterval(() => {
        frame = (frame + 1) % spinnerFrames.length
        const elapsed = style.muted(formatSeconds(Date.now() - startedAt))
        process.stdout.write(`\r${style.accent(spinnerFrames[frame])} ${title} ${elapsed}\x1b[K`)
      }, 80)
    : undefined
  if (!timer) console.log(`… ${title}`)

  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd: options.workingDirectory,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    })
    let output = ''
    child.stdout.on('data', (chunk) => (output += chunk))
    child.stderr.on('data', (chunk) => (output += chunk))
    const finish = (exitCode) => {
      if (timer) clearInterval(timer)
      if (timer) process.stdout.write('\r\x1b[K')
      if (exitCode === 0) {
        success(`${title} ${style.muted(formatSeconds(Date.now() - startedAt))}`)
        return resolve(output)
      }
      console.error(`${style.danger('✖')} ${title}`)
      const tail = output.trim().split('\n').slice(-failureOutputLines)
      for (const line of tail) console.error(style.muted(`  │ ${line}`))
      fail(options.failureTitle ?? `${title} failed`, options.failureExplanation, options.fixes)
    }
    child.on('error', (error) => {
      output += error.message
      finish(1)
    })
    child.on('close', finish)
  })
}

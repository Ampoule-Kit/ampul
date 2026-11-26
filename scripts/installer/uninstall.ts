import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { displayPath } from '../../src/system/platform.ts'
import { heading, note, style, success } from '../shared/terminalOutput.ts'
import {
  cacheDirectory,
  commandsOnPath,
  installDirectory,
  installedCommandPath,
  isDevenvBinary,
  isLegacyScriptLink,
} from './installedCommand.ts'

const yesAnswer = /^y(es)?$/i

function installedCopies(): string[] {
  const candidates = [installedCommandPath(), ...commandsOnPath('dev')]
  const uniqueCandidates = [...new Set(candidates.map((candidate) => path.resolve(candidate)))]
  return uniqueCandidates.filter(
    (candidate) =>
      isLegacyScriptLink(candidate) || (fs.existsSync(candidate) && isDevenvBinary(candidate)),
  )
}

async function askYesOrNo(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await prompt.question(`${question} ${style.muted('[y/N]')} `)
  prompt.close()
  return yesAnswer.test(answer.trim())
}

async function offerPurge(binary: string): Promise<void> {
  console.log('Your project containers, images, volumes and settings are not part of the binary.')
  if (!(await askYesOrNo('Remove all of them first, with dev purge?'))) {
    console.log(style.muted('Kept them. Run dev purge before uninstalling to remove them later.\n'))
    return
  }
  const purge = spawnSync(binary, ['purge', '--yes'], { stdio: 'inherit' })
  if (purge.status === 0) return
  console.log(
    style.warning(
      '\nThe purge did not finish, so dev was kept. Fix the problem above and run the uninstaller again.',
    ),
  )
  process.exit(1)
}

async function uninstall(): Promise<void> {
  heading('Uninstalling devenv')
  const copies = installedCopies()
  if (copies.length === 0) {
    note(
      `devenv is not installed: there is no dev command from devenv at ${displayPath(installDirectory())} or on your PATH.`,
    )
    return
  }
  const binary = copies.find((copy) => !isLegacyScriptLink(copy))
  if (binary) await offerPurge(binary)

  for (const copy of copies) {
    fs.rmSync(copy, { force: true })
    success(`Removed ${displayPath(copy)}`)
  }
  fs.rmSync(cacheDirectory, { recursive: true, force: true })
  success(`Removed the cache in ${displayPath(cacheDirectory)}`)
  console.log(
    style.muted('\nThis repository was not touched; delete it yourself if you no longer want it.'),
  )
}

await uninstall()

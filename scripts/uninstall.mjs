import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { heading, note, style, success } from './installer/console.mjs'
import {
  binaryName,
  cacheDirectory,
  commandsOnPath,
  displayPath,
  installDirectory,
  isDevenvBinary,
  isLegacyScriptLink,
} from './installer/installation.mjs'

function installedCopies() {
  const candidates = [path.join(installDirectory(), binaryName), ...commandsOnPath('dev')]
  const unique = [...new Set(candidates.map((candidate) => path.resolve(candidate)))]
  return unique.filter((candidate) => {
    if (isLegacyScriptLink(candidate)) return true
    return fs.existsSync(candidate) && isDevenvBinary(candidate)
  })
}

async function askYesNo(question) {
  if (!process.stdin.isTTY) return false
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await prompt.question(`${question} ${style.muted('[y/N]')} `)
  prompt.close()
  return /^y(es)?$/i.test(answer.trim())
}

async function offerPurge(binary) {
  console.log('Your project containers, images, volumes and settings are not part of the binary.')
  if (!(await askYesNo('Remove all of them first, with dev purge?'))) {
    console.log(style.muted('Kept them. Run dev purge before uninstalling to remove them later.\n'))
    return
  }
  const purge = spawnSync(binary, ['purge', '--yes'], { stdio: 'inherit' })
  if (purge.status !== 0) {
    console.log(
      style.warning(
        '\nThe purge did not finish, so dev was kept. Fix the problem above and run the uninstaller again.',
      ),
    )
    process.exit(1)
  }
}

async function uninstall() {
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
  fs.rmSync(cacheDirectory(), { recursive: true, force: true })
  success(`Removed the cache in ${displayPath(cacheDirectory())}`)
  console.log(
    style.muted('\nThis repository was not touched; delete it yourself if you no longer want it.'),
  )
}

await uninstall()

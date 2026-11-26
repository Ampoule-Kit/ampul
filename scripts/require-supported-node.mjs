import { readFileSync } from 'node:fs'

const fallbackMinimumNodeVersion = '26.0.0'

/** @returns {string} */
function minimumNodeVersion() {
  /** @type {unknown} */
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  if (typeof manifest !== 'object' || manifest === null || !('engines' in manifest)) {
    return fallbackMinimumNodeVersion
  }
  const { engines } = manifest
  if (typeof engines !== 'object' || engines === null || !('node' in engines)) {
    return fallbackMinimumNodeVersion
  }
  return typeof engines.node === 'string'
    ? engines.node.replace(/^\D*/, '')
    : fallbackMinimumNodeVersion
}

const minimumVersion = minimumNodeVersion()
const minimumMajor = Number(minimumVersion.split('.')[0])
const currentMajor = Number(process.versions.node.split('.')[0])

if (currentMajor < minimumMajor) {
  console.error(
    `devenv needs Node.js ${minimumVersion} or newer; this is ${process.versions.node}.`,
  )
  console.error(
    process.env['NVM_DIR']
      ? `Install and use it with nvm:  nvm install ${minimumMajor}`
      : `Install Node.js ${minimumMajor} LTS or newer from https://nodejs.org`,
  )
  process.exit(1)
}

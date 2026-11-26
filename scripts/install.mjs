import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fail, heading, note, runStep, style, success } from './installer/console.mjs'
import {
  binaryName,
  builtBinary,
  compareVersions,
  displayPath,
  installDirectory,
  isDevenvBinary,
  isLegacyScriptLink,
  isWindows,
  minimumVersions,
  repositoryRoot,
} from './installer/installation.mjs'

function nodeInstallFixes(minimumNode) {
  const major = minimumNode.split('.')[0]
  if (process.env.NVM_DIR) {
    return [
      { description: `Install and use Node.js ${major} with nvm`, command: `nvm install ${major}` },
    ]
  }
  return [{ description: `Install Node.js ${major} LTS or newer from https://nodejs.org` }]
}

function requireNormalUser() {
  if (!isWindows && process.getuid?.() === 0) {
    fail(
      'Run the installer as your normal user',
      'It was started as root or with sudo. dev must run as you, so containers are built for your user.',
      [{ description: 'Run it again without sudo', command: './install.sh' }],
    )
  }
}

function requireToolVersions(minimum) {
  const nodeVersion = process.versions.node
  if (compareVersions(nodeVersion, minimum.node) < 0) {
    fail(
      `devenv needs Node.js ${minimum.node} or newer`,
      `This is Node.js ${nodeVersion}. devenv builds on the current LTS release.`,
      nodeInstallFixes(minimum.node),
    )
  }
  const npm = spawnSync('npm', ['--version'], { encoding: 'utf8', shell: isWindows })
  const npmVersion = npm.stdout?.trim() ?? ''
  if (npm.status !== 0) {
    fail(
      'npm is not installed',
      'npm comes with Node.js and installs the build tools.',
      nodeInstallFixes(minimum.node),
    )
  }
  if (compareVersions(npmVersion, minimum.npm) < 0) {
    fail(`devenv needs npm ${minimum.npm} or newer`, `This is npm ${npmVersion}.`, [
      {
        description: 'Update npm',
        command: `npm install --global npm@${minimum.npm.split('.')[0]}`,
      },
    ])
  }
  success(`Node.js ${nodeVersion} and npm ${npmVersion}`)
}

function describeExistingInstall(target) {
  if (!isPathTaken(target)) return
  if (isLegacyScriptLink(target)) {
    note(`Replacing the old bash dev link at ${displayPath(target)}`)
    return
  }
  if (isDevenvBinary(target)) {
    const previous = spawnSync(target, ['--version'], { encoding: 'utf8' }).stdout.trim()
    note(`Replacing ${previous} at ${displayPath(target)}`)
    return
  }
  fail(
    `${displayPath(target)} already exists and is not devenv`,
    'The installer never overwrites a command it did not install.',
    [
      { description: 'Move that file away, then install again' },
      {
        description: 'Or install somewhere else',
        command: 'DEVENV_BIN_DIR=/some/dir ./install.sh',
      },
    ],
  )
}

function isPathTaken(target) {
  try {
    fs.lstatSync(target)
    return true
  } catch {
    return false
  }
}

function placeBinary(target) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const staged = `${target}.installing`
  fs.copyFileSync(builtBinary, staged)
  fs.chmodSync(staged, 0o755)
  fs.rmSync(target, { force: true })
  fs.renameSync(staged, target)
  success(`Installed ${displayPath(target)}`)
}

async function install() {
  const minimum = minimumVersions()
  heading(`Installing devenv ${minimum.devenv}`)
  requireNormalUser()
  requireToolVersions(minimum)

  const target = path.join(installDirectory(), binaryName)
  describeExistingInstall(target)

  await runStep('Installing the build tools', 'npm', ['ci', '--no-audit', '--no-fund'], {
    workingDirectory: repositoryRoot,
    failureTitle: 'npm could not install the build tools',
    failureExplanation:
      'This usually means there is no network connection, or the npm registry is unreachable.',
    fixes: [
      {
        description: 'Check the connection, then run the installer again',
        command: './install.sh',
      },
    ],
  })
  await runStep(
    `Building dev for ${process.platform}-${process.arch}`,
    process.execPath,
    [path.join('scripts', 'build.mjs')],
    {
      workingDirectory: repositoryRoot,
      failureTitle: 'The dev binary did not build',
      fixes: [
        {
          description: 'Read the output above, fix the cause, then run the installer again',
          command: './install.sh',
        },
      ],
    },
  )
  placeBinary(target)

  console.log(style.muted('\nChecking that this machine is ready…'))
  spawnSync(target, ['doctor'], { stdio: 'inherit' })
}

await install()

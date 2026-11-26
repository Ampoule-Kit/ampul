import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { environmentVariable } from '../../src/system/environment.ts'
import { displayPath } from '../../src/system/platform.ts'
import {
  builtBinaryPath,
  compareVersions,
  isWindows,
  type MinimumVersions,
  minimumVersions,
  repositoryRoot,
} from '../shared/repository.ts'
import { type Fix, fail, heading, note, runStep, style, success } from '../shared/terminalOutput.ts'
import {
  installedCommandPath,
  installedVersion,
  isLegacyScriptLink,
  isPathTaken,
} from './installedCommand.ts'

const installAgain = 'npm run cli:install'
const executablePermissions = 0o755

function nodeInstallFixes(minimumNode: string): Fix[] {
  const major = minimumNode.split('.')[0] ?? minimumNode
  if (environmentVariable('NVM_DIR')) {
    return [
      { description: `Install and use Node.js ${major} with nvm`, command: `nvm install ${major}` },
    ]
  }
  return [{ description: `Install Node.js ${major} LTS or newer from https://nodejs.org` }]
}

function requireNormalUser(): void {
  if (isWindows || process.getuid?.() !== 0) return
  fail(
    'Run the installer as your normal user',
    'It was started as root or with sudo. dev must run as you, so containers are built for your user.',
    [{ description: 'Run it again without sudo', command: installAgain }],
  )
}

function installedNpmVersion(minimum: MinimumVersions): string {
  const npm = spawnSync('npm', ['--version'], { encoding: 'utf8', shell: isWindows })
  if (npm.status !== 0) {
    fail(
      'npm is not installed',
      'npm comes with Node.js and installs the build tools.',
      nodeInstallFixes(minimum.node),
    )
  }
  return npm.stdout.trim()
}

function requireToolVersions(minimum: MinimumVersions): void {
  const nodeVersion = process.versions.node
  if (compareVersions(nodeVersion, minimum.node) < 0) {
    fail(
      `devenv needs Node.js ${minimum.node} or newer`,
      `This is Node.js ${nodeVersion}. devenv builds on the current LTS release.`,
      nodeInstallFixes(minimum.node),
    )
  }
  const npmVersion = installedNpmVersion(minimum)
  if (compareVersions(npmVersion, minimum.npm) < 0) {
    fail(`devenv needs npm ${minimum.npm} or newer`, `This is npm ${npmVersion}.`, [
      {
        description: 'Update npm',
        command: `npm install --global npm@${minimum.npm.split('.')[0] ?? minimum.npm}`,
      },
    ])
  }
  success(`Node.js ${nodeVersion} and npm ${npmVersion}`)
}

function describeExistingInstall(target: string): void {
  if (!isPathTaken(target)) return
  if (isLegacyScriptLink(target)) {
    note(`Replacing the old bash dev link at ${displayPath(target)}`)
    return
  }
  const previousVersion = installedVersion(target)
  if (previousVersion) {
    note(`Replacing ${previousVersion} at ${displayPath(target)}`)
    return
  }
  fail(
    `${displayPath(target)} already exists and is not devenv`,
    'The installer never overwrites a command it did not install.',
    [
      { description: 'Move that file away, then install again' },
      {
        description: 'Or install somewhere else',
        command: `DEVENV_BIN_DIR=/some/dir ${installAgain}`,
      },
    ],
  )
}

function placeBinary(target: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const stagedCopy = `${target}.installing`
  fs.copyFileSync(builtBinaryPath, stagedCopy)
  fs.chmodSync(stagedCopy, executablePermissions)
  fs.rmSync(target, { force: true })
  fs.renameSync(stagedCopy, target)
  success(`Installed ${displayPath(target)}`)
}

async function installBuildTools(): Promise<void> {
  await runStep(
    'Installing the build tools',
    'npm',
    ['ci', '--no-audit', '--no-fund'],
    repositoryRoot,
    {
      title: 'npm could not install the build tools',
      explanation:
        'This usually means there is no network connection, or the npm registry is unreachable.',
      fixes: [
        {
          description: 'Check the connection, then run the installer again',
          command: installAgain,
        },
      ],
    },
  )
}

async function buildBinary(): Promise<void> {
  await runStep(
    `Building dev for ${process.platform}-${process.arch}`,
    process.execPath,
    [path.join('scripts', 'build', 'buildBinary.ts')],
    repositoryRoot,
    {
      title: 'The dev binary did not build',
      fixes: [
        {
          description: 'Read the output above, fix the cause, then run the installer again',
          command: installAgain,
        },
      ],
    },
  )
}

async function install(): Promise<void> {
  const minimum = minimumVersions()
  heading(`Installing devenv ${minimum.devenv}`)
  requireNormalUser()
  requireToolVersions(minimum)

  const target = installedCommandPath()
  describeExistingInstall(target)
  await installBuildTools()
  await buildBinary()
  placeBinary(target)

  console.log(style.muted('\nChecking that this machine is ready…'))
  spawnSync(target, ['doctor'], { stdio: 'inherit' })
}

await install()

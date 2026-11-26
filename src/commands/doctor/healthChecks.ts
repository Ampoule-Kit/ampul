import fs from 'node:fs'
import path from 'node:path'
import sea from 'node:sea'
import { ContainerEngine } from '../../engine/ContainerEngine.ts'
import { diagnoseEngine } from '../../engine/engineReadiness.ts'
import {
  listPodmanMachines,
  machineMemoryCommand,
  mebibytesAsGigabytes,
  preferredMachine,
  recommendedMachineMemoryMebibytes,
  usesPodmanMachine,
} from '../../engine/podmanMachine.ts'
import { selectRuntime } from '../../engine/runtimeSelection.ts'
import { asProblem, type ProblemFix } from '../../problems/Problem.ts'
import { findExecutable } from '../../system/executables.ts'
import { displayPath, homeDirectory, isRunningAsRoot } from '../../system/platform.ts'
import { captureCommand } from '../../system/processes.ts'

export type HealthStatus = 'pass' | 'warn' | 'fail'

export interface HealthCheck {
  title: string
  status: HealthStatus
  detail: string
  fixes?: ProblemFix[] | undefined
}

function failureFrom(title: string, error: unknown): HealthCheck {
  const problem = asProblem(error)
  return {
    title,
    status: 'fail',
    detail: [problem.title, problem.explanation].filter(Boolean).join('. '),
    fixes: problem.fixes,
  }
}

async function runtimeChecks(): Promise<HealthCheck[]> {
  let engine: ContainerEngine
  try {
    engine = new ContainerEngine(selectRuntime())
  } catch (error) {
    return [failureFrom('Container runtime', error)]
  }
  const checks: HealthCheck[] = [
    {
      title: 'Container runtime',
      status: 'pass',
      detail: `${engine.displayName} ${await engine.clientVersion()} · ${engine.selection.reason}`,
    },
  ]
  const diagnosis = await diagnoseEngine(engine)
  checks.push(
    diagnosis.ready
      ? { title: 'Container engine', status: 'pass', detail: 'Running and reachable.' }
      : {
          title: 'Container engine',
          status: 'fail',
          detail: [diagnosis.problem.title, diagnosis.problem.explanation]
            .filter(Boolean)
            .join('. '),
          fixes: diagnosis.problem.fixes,
        },
  )
  if (usesPodmanMachine(engine)) {
    const machine = preferredMachine(await listPodmanMachines(engine))
    if (machine) checks.push(machineMemoryCheck(machine.name, machine.memoryMebibytes))
  }
  return checks
}

function machineMemoryCheck(machineName: string, memoryMebibytes: number): HealthCheck {
  const memory = mebibytesAsGigabytes(memoryMebibytes)
  if (memoryMebibytes >= recommendedMachineMemoryMebibytes) {
    return { title: 'Podman machine memory', status: 'pass', detail: memory }
  }
  return {
    title: 'Podman machine memory',
    status: 'warn',
    detail: `${memory}. Building .NET or Node projects and running containers inside them needs at least ${mebibytesAsGigabytes(recommendedMachineMemoryMebibytes)}; 6–8 GB for larger projects.`,
    fixes: [{ description: 'Give it more memory', command: machineMemoryCommand(machineName) }],
  }
}

async function gitChecks(): Promise<HealthCheck[]> {
  if (!findExecutable('git')) {
    return [
      {
        title: 'git',
        status: 'fail',
        detail:
          'git is not installed, so containers get no git config and folders cannot be copied by git.',
        fixes: [{ description: 'Install git: https://git-scm.com/downloads' }],
      },
    ]
  }
  const { stdout } = await captureCommand('git', ['config', '--global', 'user.name'])
  return [
    stdout.trim()
      ? {
          title: 'git',
          status: 'pass',
          detail: `Commits in containers are made as ${stdout.trim()}.`,
        }
      : {
          title: 'git',
          status: 'warn',
          detail: 'No user.name is set, so commits made in containers have no author.',
          fixes: [
            { description: 'Set your name', command: 'git config --global user.name "Your Name"' },
          ],
        },
  ]
}

function sshCheck(): HealthCheck {
  const sshDirectory = path.join(homeDirectory, '.ssh')
  if (fs.existsSync(sshDirectory)) {
    return {
      title: 'SSH',
      status: 'pass',
      detail: `${displayPath(sshDirectory)} is shared with containers, read-only.`,
    }
  }
  return {
    title: 'SSH',
    status: 'warn',
    detail: 'There is no ~/.ssh, so SSH repository URLs will not clone. HTTPS URLs still work.',
    fixes: [{ description: 'Create a key', command: 'ssh-keygen -t ed25519' }],
  }
}

function installationCheck(): HealthCheck | undefined {
  if (!sea.isSea()) return undefined
  const onPath = findExecutable('dev')
  if (onPath && fs.realpathSync(onPath) === fs.realpathSync(process.execPath)) {
    return { title: 'dev command', status: 'pass', detail: `Installed at ${displayPath(onPath)}.` }
  }
  return {
    title: 'dev command',
    status: 'warn',
    detail: onPath
      ? `Another dev at ${displayPath(onPath)} comes first on your PATH and hides this one.`
      : `${displayPath(path.dirname(process.execPath))} is not on your PATH.`,
    fixes: [
      {
        description: 'Add it to your shell profile, then open a new terminal',
        command: `export PATH="${path.dirname(process.execPath)}:$PATH"`,
      },
    ],
  }
}

function userCheck(): HealthCheck {
  if (!isRunningAsRoot())
    return { title: 'User', status: 'pass', detail: 'Running as your normal user.' }
  return {
    title: 'User',
    status: 'fail',
    detail:
      'dev runs as root. Containers would be built for root and your files would end up owned by root.',
    fixes: [{ description: 'Run dev as your normal user, without sudo' }],
  }
}

export async function runHealthChecks(): Promise<HealthCheck[]> {
  const installation = installationCheck()
  return [
    ...(await runtimeChecks()),
    ...(await gitChecks()),
    sshCheck(),
    userCheck(),
    ...(installation ? [installation] : []),
  ]
}

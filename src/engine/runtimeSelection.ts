import { Problem, type ProblemFix } from '../problems/Problem.ts'
import { ampulSettings } from '../settings/settingsStore.ts'
import { environmentVariable } from '../system/environment.ts'
import { findExecutable } from '../system/executables.ts'
import { ampulPaths, displayPath, isLinux, isMacOS } from '../system/platform.ts'
import { type RuntimeName, runtimeDisplayNames, runtimeNames } from './runtimeNames.ts'

export interface RuntimeSelection {
  name: RuntimeName
  executable: string
  reason: string
}

const runtimeEnvironmentVariable = 'AMPUL_RUNTIME'

function isRuntimeName(value: string): value is RuntimeName {
  return runtimeNames.some((runtimeName) => runtimeName === value)
}

function requestedRuntime(): { name: string; origin: string } | undefined {
  const fromEnvironment = environmentVariable(runtimeEnvironmentVariable)
  if (fromEnvironment) {
    return {
      name: fromEnvironment,
      origin: `the ${runtimeEnvironmentVariable} environment variable`,
    }
  }
  const { runtime } = ampulSettings()
  if (runtime === 'auto') return undefined
  return { name: runtime, origin: displayPath(ampulPaths.settings) }
}

export function selectRuntime(): RuntimeSelection {
  const requested = requestedRuntime()
  if (requested) return selectRequestedRuntime(requested.name, requested.origin)

  const podman = findExecutable('podman')
  const docker = findExecutable('docker')
  if (podman) {
    const reason = docker
      ? 'Podman and Docker are both installed; ampul prefers Podman.'
      : 'Podman is installed.'
    return { name: 'podman', executable: podman, reason }
  }
  if (docker) {
    return { name: 'docker', executable: docker, reason: 'Docker is installed; Podman is not.' }
  }
  throw noRuntimeInstalled()
}

function selectRequestedRuntime(name: string, origin: string): RuntimeSelection {
  if (!isRuntimeName(name)) {
    throw new Problem(`'${name}' is not a container runtime ampul supports`, {
      explanation: `${origin} asks for '${name}'. ampul works with podman or docker.`,
      fixes: [{ description: `Set it to podman or docker in ${origin}` }],
    })
  }
  const executable = findExecutable(name)
  if (!executable) {
    throw new Problem(`${runtimeDisplayNames[name]} is not installed`, {
      explanation: `${origin} asks for ${name}, but there is no ${name} command on your PATH.`,
      fixes: [...installFixes(name), { description: `Or change ${origin}` }],
    })
  }
  return { name, executable, reason: `Chosen in ${origin}.` }
}

function installFixes(runtime: RuntimeName): ProblemFix[] {
  if (runtime === 'podman') {
    if (isMacOS)
      return [{ description: 'Install Podman with Homebrew', command: 'brew install podman' }]
    if (isLinux) {
      return [
        {
          description: 'Install Podman from your distribution',
          command: 'sudo apt install podman',
        },
      ]
    }
    return [{ description: 'Install Podman Desktop from https://podman.io' }]
  }
  if (isLinux) {
    return [{ description: 'Install Docker Engine: https://docs.docker.com/engine/install/' }]
  }
  return [
    { description: 'Install Docker Desktop: https://www.docker.com/products/docker-desktop/' },
  ]
}

function noRuntimeInstalled(): Problem {
  return new Problem('No container runtime is installed', {
    explanation:
      'ampul runs every project in a container, so it needs Podman (preferred) or Docker on this machine.',
    fixes: [...installFixes('podman'), ...installFixes('docker').map(asAlternative)],
  })
}

function asAlternative(fix: ProblemFix): ProblemFix {
  return {
    ...fix,
    description: `Or: ${fix.description.charAt(0).toLowerCase()}${fix.description.slice(1)}`,
  }
}

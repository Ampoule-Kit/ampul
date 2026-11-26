import { Problem, type ProblemFix } from '../problems/Problem.js'
import { findExecutable } from '../system/executables.js'
import { devenvPaths, displayPath, isLinux, isMacOS } from '../system/platform.js'
import { preferences } from '../system/preferences.js'

export type RuntimeName = 'podman' | 'docker'

export interface RuntimeSelection {
  name: RuntimeName
  executable: string
  reason: string
}

const runtimeNames: RuntimeName[] = ['podman', 'docker']

export const runtimeDisplayNames: Record<RuntimeName, string> = {
  podman: 'Podman',
  docker: 'Docker',
}

function isRuntimeName(value: string): value is RuntimeName {
  return (runtimeNames as string[]).includes(value)
}

function requestedRuntime(): { name: string; origin: string } | undefined {
  if (process.env.DEVENV_RUNTIME) {
    return { name: process.env.DEVENV_RUNTIME, origin: 'the DEVENV_RUNTIME environment variable' }
  }
  const configured = preferences().runtime
  if (configured) return { name: configured, origin: displayPath(devenvPaths.preferences) }
  return undefined
}

export function selectRuntime(): RuntimeSelection {
  const requested = requestedRuntime()
  if (requested) return selectRequestedRuntime(requested.name, requested.origin)

  const podman = findExecutable('podman')
  const docker = findExecutable('docker')
  if (podman) {
    const reason = docker
      ? 'Podman and Docker are both installed; devenv prefers Podman.'
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
    throw new Problem(`'${name}' is not a container runtime devenv supports`, {
      explanation: `${origin} asks for '${name}'. devenv works with podman or docker.`,
      fixes: [{ description: `Set it to podman or docker in ${origin}` }],
    })
  }
  const executable = findExecutable(name)
  if (!executable) {
    throw new Problem(`${runtimeDisplayNames[name]} is not installed`, {
      explanation: `${origin} asks for ${name}, but there is no ${name} command on your PATH.`,
      fixes: [...installFixes(name), { description: `Or remove the setting from ${origin}` }],
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
      'devenv runs every project in a container, so it needs Podman (preferred) or Docker on this machine.',
    fixes: [...installFixes('podman'), ...installFixes('docker').map(asAlternative)],
  })
}

function asAlternative(fix: ProblemFix): ProblemFix {
  return {
    ...fix,
    description: `Or: ${fix.description.charAt(0).toLowerCase()}${fix.description.slice(1)}`,
  }
}

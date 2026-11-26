import type { ContainerEngine } from '../engine/ContainerEngine.js'
import { containerName, projectLabel, projectNameFromContainerName } from './naming.js'

export type ContainerState = 'running' | 'stopped' | 'paused' | 'missing'

function toContainerState(runtimeStatus: string): ContainerState {
  const status = runtimeStatus.trim().toLowerCase()
  if (status === 'running') return 'running'
  if (status === 'paused') return 'paused'
  if (!status) return 'missing'
  return 'stopped'
}

export async function containerState(
  engine: ContainerEngine,
  projectName: string,
): Promise<ContainerState> {
  const { exitCode, stdout } = await engine.capture([
    'container',
    'inspect',
    '--format',
    '{{.State.Status}}',
    containerName(projectName),
  ])
  return exitCode === 0 ? toContainerState(stdout) : 'missing'
}

export async function allContainerStates(engine: ContainerEngine): Promise<Map<string, ContainerState>> {
  const { stdout } = await engine.capture([
    'ps',
    '--all',
    '--filter',
    `label=${projectLabel}`,
    '--format',
    '{{.Names}}\t{{.State}}',
  ])
  const states = new Map<string, ContainerState>()
  for (const line of stdout.split('\n').filter(Boolean)) {
    const [name = '', status = ''] = line.split('\t')
    const projectName = projectNameFromContainerName(name.trim())
    if (projectName) states.set(projectName, toContainerState(status))
  }
  return states
}

export const containerStateLabels: Record<ContainerState, string> = {
  running: 'running',
  stopped: 'stopped',
  paused: 'paused',
  missing: 'no container',
}

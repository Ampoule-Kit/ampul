import type { ContainerEngine } from './ContainerEngine.js'

export interface PodmanMachine {
  name: string
  isDefault: boolean
  isRunning: boolean
  isStarting: boolean
  memoryMebibytes: number
  cpus: number
}

interface PodmanMachineListEntry {
  Name: string
  Default: boolean
  Running: boolean
  Starting: boolean
  Memory: string
  CPUs: number
}

export const recommendedMachineMemoryMebibytes = 4096
const bytesPerMebibyte = 1024 * 1024

export function usesPodmanMachine(engine: ContainerEngine): boolean {
  return engine.runtime === 'podman' && process.platform !== 'linux'
}

export async function listPodmanMachines(engine: ContainerEngine): Promise<PodmanMachine[]> {
  const { exitCode, stdout } = await engine.capture(['machine', 'list', '--format', 'json'])
  if (exitCode !== 0 || !stdout.trim()) return []
  const entries = JSON.parse(stdout) as PodmanMachineListEntry[]
  return entries.map((entry) => ({
    name: entry.Name.replace(/\*$/, ''),
    isDefault: entry.Default,
    isRunning: entry.Running,
    isStarting: entry.Starting,
    memoryMebibytes: Math.round(Number(entry.Memory) / bytesPerMebibyte),
    cpus: entry.CPUs,
  }))
}

export function preferredMachine(machines: PodmanMachine[]): PodmanMachine | undefined {
  return (
    machines.find((machine) => machine.isRunning) ??
    machines.find((machine) => machine.isDefault) ??
    machines[0]
  )
}

export function machineMemoryCommand(machineName: string): string {
  return [
    `podman machine stop ${machineName}`,
    `podman machine set --memory ${recommendedMachineMemoryMebibytes} ${machineName}`,
    `podman machine start ${machineName}`,
  ].join(' && ')
}

import { z } from 'zod'
import { isLinux } from '../system/platform.ts'
import type { ContainerEngine } from './ContainerEngine.ts'

export interface PodmanMachine {
  name: string
  isDefault: boolean
  isRunning: boolean
  isStarting: boolean
  memoryMebibytes: number
  cpus: number
}

const podmanMachineListSchema = z.array(
  z.object({
    Name: z.string(),
    Default: z.boolean(),
    Running: z.boolean(),
    Starting: z.boolean(),
    Memory: z.coerce.number(),
    CPUs: z.number(),
  }),
)

export const recommendedMachineMemoryMebibytes = 4096
const bytesPerMebibyte = 1024 * 1024
const mebibytesPerGibibyte = 1024
const defaultMachineMarker = /\*$/

export function mebibytesAsGigabytes(mebibytes: number): string {
  return `${Math.round((mebibytes / mebibytesPerGibibyte) * 10) / 10} GB`
}

export function usesPodmanMachine(engine: ContainerEngine): boolean {
  return engine.runtime === 'podman' && !isLinux
}

export async function listPodmanMachines(engine: ContainerEngine): Promise<PodmanMachine[]> {
  const { exitCode, stdout } = await engine.capture(['machine', 'list', '--format', 'json'])
  if (exitCode !== 0 || !stdout.trim()) return []
  const parsed = podmanMachineListSchema.safeParse(JSON.parse(stdout))
  if (!parsed.success) return []
  return parsed.data.map((entry) => ({
    name: entry.Name.replace(defaultMachineMarker, ''),
    isDefault: entry.Default,
    isRunning: entry.Running,
    isStarting: entry.Starting,
    memoryMebibytes: Math.round(entry.Memory / bytesPerMebibyte),
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

import { spawn } from 'node:child_process'
import sea from 'node:sea'
import { setTimeout as wait } from 'node:timers/promises'
import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import {
  isProcessAlive,
  projectsWithForwarders,
  readLiveLock,
  removeForwarderFiles,
} from './forwarderFiles.ts'
import { containerIdOf, forwarderCommandName } from './forwarderProcess.ts'

const stopPollMilliseconds = 50
const stopTimeoutMilliseconds = 3000

function ownInvocation(): string[] {
  if (sea.isSea()) return process.execArgv
  return [...process.execArgv, process.argv[1] ?? '']
}

async function terminate(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    return
  }
  for (let waited = 0; waited < stopTimeoutMilliseconds; waited += stopPollMilliseconds) {
    if (!isProcessAlive(pid)) return
    await wait(stopPollMilliseconds)
  }
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    // It ended on its own in the meantime.
  }
}

export async function ensurePortForwarding(
  engine: ContainerEngine,
  projectName: string,
): Promise<void> {
  const containerId = await containerIdOf(engine, projectName)
  if (!containerId) return
  const lock = readLiveLock(projectName)
  if (lock?.containerId === containerId) return
  if (lock) await stopPortForwarding(projectName)

  const child = spawn(
    process.execPath,
    [
      ...ownInvocation(),
      forwarderCommandName,
      projectName,
      engine.runtime,
      engine.selection.executable,
    ],
    { detached: true, stdio: 'ignore', windowsHide: true },
  )
  child.on('error', () => {})
  child.unref()
}

export async function stopPortForwarding(projectName: string): Promise<void> {
  const lock = readLiveLock(projectName)
  if (lock) await terminate(lock.pid)
  removeForwarderFiles(projectName)
}

export async function stopAllPortForwarding(): Promise<void> {
  for (const projectName of projectsWithForwarders()) await stopPortForwarding(projectName)
}

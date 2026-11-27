import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { errorCode } from '../system/errorCodes.ts'
import { ampulPaths } from '../system/platform.ts'
import type { ForwardingReport } from './PortForwarder.ts'

const lockSchema = z.object({ pid: z.int(), containerId: z.string() })
const reportSchema = z.object({ forwarded: z.array(z.int()), unavailable: z.array(z.int()) })

export type ForwarderLock = z.infer<typeof lockSchema>

function lockFile(projectName: string): string {
  return path.join(ampulPaths.forwarding, `${projectName}.pid`)
}

function reportFile(projectName: string): string {
  return path.join(ampulPaths.forwarding, `${projectName}.json`)
}

function readJson<T>(file: string, schema: z.ZodType<T>): T | undefined {
  try {
    const parsed = schema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return errorCode(error) === 'EPERM'
  }
}

export function readLiveLock(projectName: string): ForwarderLock | undefined {
  const lock = readJson(lockFile(projectName), lockSchema)
  return lock && isProcessAlive(lock.pid) ? lock : undefined
}

export function claimLock(projectName: string, containerId: string): boolean {
  fs.mkdirSync(ampulPaths.forwarding, { recursive: true })
  const content = JSON.stringify({ pid: process.pid, containerId })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(lockFile(projectName), content, { flag: 'wx' })
      return true
    } catch (error) {
      if (errorCode(error) !== 'EEXIST') throw error
      if (readLiveLock(projectName)) return false
      fs.rmSync(lockFile(projectName), { force: true })
    }
  }
  return false
}

export function releaseLock(projectName: string): void {
  const lock = readJson(lockFile(projectName), lockSchema)
  if (lock?.pid !== process.pid) return
  fs.rmSync(reportFile(projectName), { force: true })
  fs.rmSync(lockFile(projectName), { force: true })
}

export function removeForwarderFiles(projectName: string): void {
  fs.rmSync(reportFile(projectName), { force: true })
  fs.rmSync(lockFile(projectName), { force: true })
}

export function writeReport(projectName: string, report: ForwardingReport): void {
  const file = reportFile(projectName)
  const staging = `${file}.${process.pid}`
  fs.writeFileSync(staging, JSON.stringify(report) + '\n')
  fs.renameSync(staging, file)
}

export function readReport(projectName: string): ForwardingReport | undefined {
  if (!readLiveLock(projectName)) return undefined
  return readJson(reportFile(projectName), reportSchema)
}

export function projectsWithForwarders(): string[] {
  try {
    return fs
      .readdirSync(ampulPaths.forwarding)
      .filter((entry) => entry.endsWith('.pid'))
      .map((entry) => entry.slice(0, -'.pid'.length))
  } catch {
    return []
  }
}

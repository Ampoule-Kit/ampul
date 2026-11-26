import fs from 'node:fs'
import path from 'node:path'
import { devenvPaths } from '../system/platform.js'

const logsKeptPerProject = 10

export class LogFile {
  readonly path: string

  constructor(scope: string, purpose: string) {
    const directory = path.join(devenvPaths.logs, scope)
    fs.mkdirSync(directory, { recursive: true })
    removeOldLogs(directory)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
    this.path = path.join(directory, `${timestamp}-${purpose}.log`)
    fs.writeFileSync(this.path, '')
  }

  write(text: string): void {
    fs.appendFileSync(this.path, text)
  }

  heading(title: string): void {
    this.write(`\n==> ${title}\n`)
  }
}

function removeOldLogs(directory: string): void {
  const logs = fs
    .readdirSync(directory)
    .filter((entry) => entry.endsWith('.log'))
    .sort()
  for (const oldLog of logs.slice(0, Math.max(0, logs.length - logsKeptPerProject + 1))) {
    fs.rmSync(path.join(directory, oldLog), { force: true })
  }
}

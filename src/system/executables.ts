import fs from 'node:fs'
import path from 'node:path'
import { isWindows } from './platform.js'

function executableExtensions(): string[] {
  if (!isWindows) return ['']
  const extensions = (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';')
  return ['', ...extensions.map((extension) => extension.toLowerCase())]
}

function isExecutableFile(candidate: string): boolean {
  try {
    if (!fs.statSync(candidate).isFile()) return false
    fs.accessSync(candidate, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

export function findExecutable(name: string): string | undefined {
  const searchDirectories = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  for (const directory of searchDirectories) {
    for (const extension of executableExtensions()) {
      const candidate = path.join(directory, name + extension)
      if (isExecutableFile(candidate)) return candidate
    }
  }
  return undefined
}

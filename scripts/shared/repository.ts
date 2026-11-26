import fs from 'node:fs'
import path from 'node:path'

export const repositoryRoot = path.resolve(import.meta.dirname, '..', '..')
export const isWindows = process.platform === 'win32'
export const isMacOS = process.platform === 'darwin'
export const binaryFileName = isWindows ? 'ampul.exe' : 'ampul'
export const builtBinaryPath = path.join(repositoryRoot, 'dist', binaryFileName)

interface PackageManifest {
  version: string
  engines: { node: string; npm: string }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPackageManifest(value: unknown): value is PackageManifest {
  if (!isRecord(value) || typeof value['version'] !== 'string') return false
  const engines = value['engines']
  return (
    isRecord(engines) && typeof engines['node'] === 'string' && typeof engines['npm'] === 'string'
  )
}

export interface MinimumVersions {
  ampul: string
  node: string
  npm: string
}

function withoutRangeOperator(range: string): string {
  return range.replace(/^\D*/, '')
}

export function minimumVersions(): MinimumVersions {
  const manifestFile = path.join(repositoryRoot, 'package.json')
  const manifest: unknown = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  if (!isPackageManifest(manifest)) {
    throw new Error('package.json needs a version and engines.node and engines.npm')
  }
  return {
    ampul: manifest.version,
    node: withoutRangeOperator(manifest.engines.node),
    npm: withoutRangeOperator(manifest.engines.npm),
  }
}

export function compareVersions(actual: string, minimum: string): number {
  const actualParts = actual.split('.').map(Number)
  const minimumParts = minimum.split('.').map(Number)
  for (const [index, minimumPart] of minimumParts.entries()) {
    const difference = (actualParts[index] ?? 0) - minimumPart
    if (difference !== 0) return difference
  }
  return 0
}

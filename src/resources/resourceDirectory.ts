import fs from 'node:fs'
import path from 'node:path'
import sea from 'node:sea'
import { fileURLToPath } from 'node:url'
import { devenvPaths } from '../system/platform.js'

interface EmbeddedFile {
  path: string
  mode: number
  content: string
}

interface EmbeddedResources {
  fingerprint: string
  files: EmbeddedFile[]
}

const embeddedResourcesAssetName = 'resources'
const completionMarker = '.complete'

let cachedResourceDirectory: string | undefined

export function resourceDirectory(): string {
  cachedResourceDirectory ??= sea.isSea() ? extractEmbeddedResources() : repositoryRoot()
  return cachedResourceDirectory
}

export function resourcePath(...segments: string[]): string {
  return path.join(resourceDirectory(), ...segments)
}

function repositoryRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
}

function extractEmbeddedResources(): string {
  const resources = JSON.parse(
    sea.getAsset(embeddedResourcesAssetName, 'utf8'),
  ) as EmbeddedResources
  const resourcesRoot = path.join(devenvPaths.cache, 'resources')
  const destination = path.join(resourcesRoot, resources.fingerprint)
  if (fs.existsSync(path.join(destination, completionMarker))) return destination

  const staging = `${destination}.partial-${process.pid}`
  fs.rmSync(staging, { recursive: true, force: true })
  for (const file of resources.files) {
    const target = path.join(staging, file.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, Buffer.from(file.content, 'base64'), { mode: file.mode })
  }
  fs.writeFileSync(path.join(staging, completionMarker), '')
  fs.rmSync(destination, { recursive: true, force: true })
  fs.renameSync(staging, destination)
  removeOtherResourceVersions(resourcesRoot, resources.fingerprint)
  return destination
}

function removeOtherResourceVersions(resourcesRoot: string, currentFingerprint: string): void {
  for (const entry of fs.readdirSync(resourcesRoot)) {
    if (entry === currentFingerprint || entry.includes('.partial-')) continue
    fs.rmSync(path.join(resourcesRoot, entry), { recursive: true, force: true })
  }
}

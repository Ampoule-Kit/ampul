import fs from 'node:fs'
import path from 'node:path'
import sea from 'node:sea'
import { ampulPaths } from '../system/platform.ts'
import { embeddedResourcesAssetName, embeddedResourcesSchema } from './embeddedResources.ts'

const completionMarker = '.complete'
const partialExtractionMarker = '.partial-'

let cachedResourceDirectory: string | undefined

export function resourceDirectory(): string {
  cachedResourceDirectory ??= sea.isSea() ? extractEmbeddedResources() : repositoryRoot()
  return cachedResourceDirectory
}

export function resourcePath(...segments: string[]): string {
  return path.join(resourceDirectory(), ...segments)
}

function repositoryRoot(): string {
  return path.resolve(import.meta.dirname, '..', '..')
}

function extractEmbeddedResources(): string {
  const resources = embeddedResourcesSchema.parse(
    JSON.parse(sea.getAsset(embeddedResourcesAssetName, 'utf8')),
  )
  const resourcesRoot = path.join(ampulPaths.cache, 'resources')
  const destination = path.join(resourcesRoot, resources.fingerprint)
  if (fs.existsSync(path.join(destination, completionMarker))) return destination

  const staging = `${destination}${partialExtractionMarker}${process.pid}`
  fs.rmSync(staging, { recursive: true, force: true })
  for (const file of resources.files) {
    const target = path.join(staging, file.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, Buffer.from(file.contentBase64, 'base64'), { mode: file.mode })
  }
  fs.writeFileSync(path.join(staging, completionMarker), '')
  fs.rmSync(destination, { recursive: true, force: true })
  fs.renameSync(staging, destination)
  removeOtherResourceVersions(resourcesRoot, resources.fingerprint)
  return destination
}

function removeOtherResourceVersions(resourcesRoot: string, currentFingerprint: string): void {
  for (const entry of fs.readdirSync(resourcesRoot)) {
    if (entry === currentFingerprint || entry.includes(partialExtractionMarker)) continue
    fs.rmSync(path.join(resourcesRoot, entry), { recursive: true, force: true })
  }
}

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { EmbeddedResources } from '../../src/resources/embeddedResources.ts'
import { repositoryRoot } from '../shared/repository.ts'

const embeddedFolders = ['image', 'container', 'dotfiles', 'modules']
const embeddedFiles = ['.dockerignore']
const fingerprintLength = 16
const permissionBits = 0o777

function filesUnder(folder: string): string[] {
  return fs
    .readdirSync(path.join(repositoryRoot, folder), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(repositoryRoot, path.join(entry.parentPath, entry.name)))
}

function asPortablePath(relativePath: string): string {
  return relativePath.split(path.sep).join('/')
}

export function embedResources(outputDirectory: string): string {
  const relativePaths = [...embeddedFolders.flatMap(filesUnder), ...embeddedFiles].toSorted()
  const fingerprint = createHash('sha256')
  const files = relativePaths.map((relativePath) => {
    const absolutePath = path.join(repositoryRoot, relativePath)
    const content = fs.readFileSync(absolutePath)
    fingerprint.update(relativePath).update(content)
    return {
      path: asPortablePath(relativePath),
      mode: fs.statSync(absolutePath).mode & permissionBits,
      contentBase64: content.toString('base64'),
    }
  })
  const resources: EmbeddedResources = {
    fingerprint: fingerprint.digest('hex').slice(0, fingerprintLength),
    files,
  }
  const resourcesFile = path.join(outputDirectory, 'resources.json')
  fs.writeFileSync(resourcesFile, JSON.stringify(resources))
  return resourcesFile
}

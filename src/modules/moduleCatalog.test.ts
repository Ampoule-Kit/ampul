import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, it } from 'node:test'
import { downloadUrl } from './downloadUrls.ts'
import { moduleCatalog, readModuleFile } from './moduleCatalog.ts'
import { supportedArchitectures } from './moduleSchema.ts'

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..')
const hasJq = spawnSync('jq', ['--version']).status === 0

function bashDownloadUrl(moduleId: string, downloadIndex: number, architecture: string): string {
  const script = `. image/module-downloads.sh && download_url "modules/${moduleId}/module.json" ${downloadIndex} ${architecture}`
  return execFileSync('bash', ['-c', script], { cwd: repositoryRoot, encoding: 'utf8' }).trim()
}

describe('the module catalog in this repo', () => {
  const catalog = moduleCatalog()

  it('loads every module, with valid files and known requirements', () => {
    assert.ok(catalog.modules.length > 0)
    for (const module of catalog.modules) {
      for (const required of module.requires) assert.ok(catalog.byId.has(required), required)
    }
  })

  it('pins a checksum for both architectures of every download', () => {
    for (const module of catalog.modules) {
      for (const download of module.downloads) {
        const checksums = download.sha256 ?? download.sha512
        assert.ok(checksums, `${module.id} downloads ${download.url} without a checksum`)
      }
    }
  })

  it('has a check command for every module', () => {
    for (const module of catalog.modules) assert.ok(readModuleFile(module.id).check)
  })

  it('expands download URLs the same way as the install script in the image', {
    skip: !hasJq,
  }, () => {
    for (const module of catalog.modules) {
      for (const [index, download] of module.downloads.entries()) {
        for (const architecture of supportedArchitectures) {
          assert.equal(
            downloadUrl(module, download, architecture),
            bashDownloadUrl(module.id, index, architecture),
          )
        }
      }
    }
  })
})

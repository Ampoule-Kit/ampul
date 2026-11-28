import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { downloadUrl } from './downloadUrls.ts'
import { moduleCatalog, readModuleFile } from './moduleCatalog.ts'
import { supportedArchitectures } from './moduleSchema.ts'
import { installOf } from './moduleSelection.ts'
import { parseRequirement } from './moduleVersions.ts'

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..')
const hasJq = spawnSync('jq', ['--version']).status === 0

const resolvedVersionsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ampul-versions-'))
after(() => fs.rmSync(resolvedVersionsDirectory, { recursive: true, force: true }))

function bashModuleFile(moduleId: string, versionId: string | undefined): string {
  const moduleFile = path.join(repositoryRoot, 'modules', moduleId, 'module.json')
  if (versionId === undefined) return moduleFile
  const script = `. image/module-downloads.sh && module_version_file "${moduleFile}" ${versionId}`
  const resolved = path.join(resolvedVersionsDirectory, `${moduleId}@${versionId}.json`)
  fs.writeFileSync(resolved, execFileSync('bash', ['-c', script], { cwd: repositoryRoot }))
  return resolved
}

function bashDownloadUrl(moduleFile: string, downloadIndex: number, architecture: string): string {
  const script = `. image/module-downloads.sh && download_url "${moduleFile}" ${downloadIndex} ${architecture}`
  return execFileSync('bash', ['-c', script], { cwd: repositoryRoot, encoding: 'utf8' }).trim()
}

describe('the module catalog in this repo', () => {
  const catalog = moduleCatalog()
  const everyInstall = () =>
    catalog.modules.flatMap((module) =>
      module.versions.map((version) => installOf(module, version)),
    )

  it('loads every module, with valid files and known requirements', () => {
    assert.ok(catalog.modules.length > 0)
    for (const module of catalog.modules) {
      for (const version of module.versions) {
        for (const required of version.requires) {
          assert.ok(catalog.byId.has(parseRequirement(required).moduleId), required)
        }
      }
    }
  })

  it('pins a checksum for both architectures of every download', () => {
    for (const install of everyInstall()) {
      for (const download of install.downloads) {
        const checksums = download.sha256 ?? download.sha512
        assert.ok(checksums, `${install.id} downloads ${download.url} without a checksum`)
      }
    }
  })

  it('has a check command for every module', () => {
    for (const module of catalog.modules) assert.ok(readModuleFile(module.id).check)
  })

  it('expands download URLs the same way as the install script in the image', {
    skip: !hasJq,
  }, () => {
    for (const install of everyInstall()) {
      const versionId = install.hasVersionChoice ? install.versionId : undefined
      const moduleFile = bashModuleFile(install.id, versionId)
      for (const [index, download] of install.downloads.entries()) {
        for (const architecture of supportedArchitectures) {
          assert.equal(
            downloadUrl(install, download, architecture),
            bashDownloadUrl(moduleFile, index, architecture),
          )
        }
      }
    }
  })
})

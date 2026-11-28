import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ModuleFileSource } from '../../src/modules/moduleSchema.ts'
import { compareVersions, highestMatch, versionFromTag, versionTargets } from './latestVersions.ts'

const architectures = { arm64: 'arm64', amd64: 'x64' }

describe('latest versions', () => {
  it('orders versions by their numbers', () => {
    assert.ok(compareVersions('0.12.10', '0.12.9') > 0)
    assert.ok(compareVersions('25.0.5.1+2', '25.0.5+11') > 0)
    assert.equal(compareVersions('4.7.2-stable', '4.7.2-stable'), 0)
    assert.ok(compareVersions('4.7.2-stable', '4.7-stable') > 0)
  })

  it('picks the highest version a page lists', () => {
    const listing = 'docker-29.9.0.tgz docker-29.10.1.tgz docker-29.10.0-rc.1.tgz docker-28.5.0.tgz'
    assert.equal(highestMatch(listing, String.raw`docker-([0-9]+\.[0-9]+\.[0-9]+)\.tgz`), '29.10.1')
    assert.equal(highestMatch('nothing here', '(\\d+)x'), undefined)
  })

  it('reads the version out of a release tag', () => {
    assert.equal(versionFromTag('v0.12.7', 'v{version}'), '0.12.7')
    assert.equal(versionFromTag('4.8-stable', '{version}'), '4.8-stable')
    assert.equal(versionFromTag('jdk-25.0.6+7', 'jdk-{version:url}'), '25.0.6+7')
    assert.equal(versionFromTag('nightly', 'v{version}'), undefined)
  })

  it('finds what can be pinned in a module, and where its latest version comes from', () => {
    const module: ModuleFileSource = {
      label: 'Tool',
      description: 'A tool',
      version: '1.0.0',
      downloads: [
        {
          url: 'https://github.com/owner/tool{version:major}/releases/download/v{version}/tool-{arch}.tar.gz',
          architectures,
          installTo: '/opt/tool',
        },
        {
          name: 'plugin',
          version: '2.0.0',
          url: 'https://example.com/plugin-{version}-{arch}.tar.gz',
          architectures,
          installTo: '/opt/plugin',
          latestVersion: { url: 'https://example.com/plugins/', match: 'plugin-([0-9.]+)-' },
        },
      ],
      check: 'tool --version',
    }
    const [tool, plugin] = versionTargets('tool', module)
    assert.deepEqual(tool?.lookup, {
      kind: 'github',
      repository: 'owner/tool1',
      tagTemplate: 'v{version}',
    })
    assert.equal(plugin?.name, 'tool:plugin')
    assert.equal(plugin?.lookup?.kind, 'page')
    assert.deepEqual(versionTargets('apt', { label: 'a', description: 'a', check: 'a' }), [])
  })

  it('pins each version of a module with versions on its own', () => {
    const download = {
      url: 'https://github.com/owner/runtime/releases/download/v{version}/runtime-{arch}.tar.gz',
      architectures,
      installTo: '/opt/runtime',
    }
    const module: ModuleFileSource = {
      label: 'Runtime',
      description: 'A runtime',
      versions: [
        {
          id: '24',
          version: '24.1.0',
          latestVersion: { url: 'https://example.com/index.json', match: 'v(24\\.[0-9.]+)' },
          downloads: [download],
        },
        { id: '22', version: '22.9.0', downloads: [download] },
      ],
      check: 'runtime --version',
    }
    const targets = versionTargets('runtime', module)
    assert.deepEqual(
      targets.map((target) => [target.name, target.versionId, target.currentVersion]),
      [
        ['runtime@24', '24', '24.1.0'],
        ['runtime@22', '22', '22.9.0'],
      ],
    )
    assert.equal(targets[0]?.lookup?.kind, 'page')
    assert.equal(targets[1]?.lookup?.kind, 'github')
  })
})

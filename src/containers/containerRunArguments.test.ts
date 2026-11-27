import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { moduleForTests } from '../modules/moduleForTests.ts'
import type { ProjectSettings } from '../projects/ProjectSettings.ts'
import { containerRunArguments } from './containerRunArguments.ts'

const project: ProjectSettings = {
  name: 'api',
  codeSource: { kind: 'repositories', repositories: [] },
  modules: [],
}

const noHostSetup = { isRootlessPodman: false, hostMounts: [], modules: [], tunnelToken: 'abc' }

describe('containerRunArguments', () => {
  it('publishes only the tunnel port, on a free port of the host loopback address', () => {
    const runArguments = containerRunArguments(project, noHostSetup)
    const published = runArguments.filter((_, index) => runArguments[index - 1] === '--publish')
    assert.deepEqual(published, ['127.0.0.1::61000'])
    assert.ok(runArguments.includes('AMPUL_TUNNEL_PORT=61000'))
    assert.ok(runArguments.includes('AMPUL_TUNNEL_TOKEN=abc'))
  })

  it('runs privileged with the volumes of the modules only when a module asks for them', () => {
    assert.ok(!containerRunArguments(project, noHostSetup).includes('--privileged'))
    const engineModule = moduleForTests('engine', {
      container: {
        privileged: true,
        volumes: [{ name: 'engine', path: '/var/lib/containers', contents: 'Images' }],
      },
    })
    const withEngine = containerRunArguments(project, { ...noHostSetup, modules: [engineModule] })
    assert.ok(withEngine.includes('--privileged'))
    assert.ok(withEngine.includes('ampul-api-engine:/var/lib/containers'))
  })

  it('keeps the user id with rootless Podman', () => {
    const rootless = containerRunArguments(project, { ...noHostSetup, isRootlessPodman: true })
    assert.ok(rootless.includes('--userns=keep-id'))
  })
})

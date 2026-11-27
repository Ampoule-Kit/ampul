import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { moduleForTests } from '../modules/moduleForTests.ts'
import type { ProjectSettings } from '../projects/ProjectSettings.ts'
import { containerRunArguments } from './containerRunArguments.ts'

const project: ProjectSettings = {
  name: 'api',
  codeSource: { kind: 'repositories', repositories: [] },
  modules: [],
  ports: [3000, 3001, 3002, 4200],
}

const noHostSetup = { isRootlessPodman: false, hostMounts: [], modules: [] }

describe('containerRunArguments', () => {
  it('publishes consecutive ports as one range on the host loopback address', () => {
    const runArguments = containerRunArguments(project, noHostSetup)
    assert.ok(runArguments.includes('127.0.0.1:3000-3002:61000-61002'))
    assert.ok(runArguments.includes('127.0.0.1:4200:61003'))
    assert.ok(
      runArguments.includes('AMPUL_PORT_FORWARDS=3000:61000 3001:61001 3002:61002 4200:61003'),
    )
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

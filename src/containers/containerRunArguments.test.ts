import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ProjectSettings } from '../projects/ProjectSettings.ts'
import { containerRunArguments } from './containerRunArguments.ts'

const project: ProjectSettings = {
  name: 'api',
  codeSource: { kind: 'repositories', repositories: [] },
  modules: [],
  ports: [3000, 3001, 3002, 4200],
}

const noHostSetup = { isRootlessPodman: false, hostMounts: [] }

describe('containerRunArguments', () => {
  it('publishes consecutive ports as one range on the host loopback address', () => {
    const runArguments = containerRunArguments(project, noHostSetup)
    assert.ok(runArguments.includes('127.0.0.1:3000-3002:61000-61002'))
    assert.ok(runArguments.includes('127.0.0.1:4200:61003'))
    assert.ok(
      runArguments.includes('DEVENV_PORT_FORWARDS=3000:61000 3001:61001 3002:61002 4200:61003'),
    )
  })

  it('runs privileged with its own storage only when the container engine module is selected', () => {
    assert.ok(!containerRunArguments(project, noHostSetup).includes('--privileged'))
    const withEngine = containerRunArguments(
      { ...project, modules: ['container-engine'] },
      noHostSetup,
    )
    assert.ok(withEngine.includes('--privileged'))
    assert.ok(withEngine.includes('devenv-api-engine:/var/lib/containers'))
  })

  it('keeps the user id with rootless Podman', () => {
    const rootless = containerRunArguments(project, { ...noHostSetup, isRootlessPodman: true })
    assert.ok(rootless.includes('--userns=keep-id'))
  })
})

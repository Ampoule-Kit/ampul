import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  describeBuildInstruction,
  isOutOfMemoryMessage,
  parseBuildStep,
} from './imageBuildOutput.ts'

describe('image build output', () => {
  it('reads the step counter of Podman and Docker', () => {
    assert.deepEqual(parseBuildStep('[2/2] STEP 7/46: RUN /opt/ampul/install-module.sh node'), {
      number: 7,
      total: 46,
      instruction: 'RUN /opt/ampul/install-module.sh node',
    })
    assert.deepEqual(
      parseBuildStep('#9 [ampul  4/40] COPY modules/node/ /opt/ampul/modules/node/'),
      {
        number: 4,
        total: 40,
        instruction: 'COPY modules/node/ /opt/ampul/modules/node/',
      },
    )
    assert.equal(parseBuildStep('Get:15 http://ports.ubuntu.com noble InRelease'), undefined)
  })

  it('names the module a step installs', () => {
    const modules = [{ id: 'node', label: 'Node.js' }]
    assert.equal(
      describeBuildInstruction('RUN --mount=type=cache /opt/ampul/install-module.sh node', modules),
      'Installing Node.js',
    )
    assert.equal(
      describeBuildInstruction('FROM ubuntu AS base', modules),
      'Preparing the Ubuntu base image',
    )
  })

  it('notices when the build ran out of memory', () => {
    assert.ok(isOutOfMemoryMessage('process "/bin/sh" did not complete: exit code: 137'))
    assert.ok(!isOutOfMemoryMessage('exit code: 1'))
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  describeBuildInstruction,
  isOutOfMemoryMessage,
  parseBuildStep,
} from './imageBuildOutput.ts'

describe('image build output', () => {
  it('reads the step counter of Podman and Docker', () => {
    assert.deepEqual(parseBuildStep('[2/2] STEP 7/46: RUN /opt/ampul/install-module.sh runtime'), {
      number: 7,
      total: 46,
      instruction: 'RUN /opt/ampul/install-module.sh runtime',
    })
    assert.deepEqual(
      parseBuildStep('#9 [ampul  4/40] COPY modules/runtime/ /opt/ampul/modules/runtime/'),
      {
        number: 4,
        total: 40,
        instruction: 'COPY modules/runtime/ /opt/ampul/modules/runtime/',
      },
    )
    assert.equal(parseBuildStep('Get:15 http://ports.ubuntu.com resolute InRelease'), undefined)
  })

  it('names the module a step installs', () => {
    const modules = [{ id: 'runtime', label: 'Runtime' }]
    assert.equal(
      describeBuildInstruction(
        'RUN --mount=type=cache /opt/ampul/install-module.sh runtime',
        modules,
      ),
      'Installing Runtime',
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

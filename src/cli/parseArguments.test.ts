import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { CommandDefinition } from './CommandDefinition.ts'
import { parseArguments } from './parseArguments.ts'

const stopCommand: CommandDefinition = {
  name: 'stop',
  summary: '',
  arguments: [{ name: 'project', required: false, description: '' }],
  flags: [{ name: 'all', short: 'a', description: '' }],
  description: [],
  examples: [],
  seeAlso: [],
  run: () => 0,
}

describe('parseArguments', () => {
  it('separates positionals from long and short flags', () => {
    assert.deepEqual(parseArguments(stopCommand, ['api']), {
      positionals: ['api'],
      flags: new Set(),
    })
    assert.deepEqual(parseArguments(stopCommand, ['-a']).flags, new Set(['all']))
    assert.deepEqual(parseArguments(stopCommand, ['--help']).flags, new Set(['help']))
  })

  it('treats everything after -- as positionals', () => {
    assert.deepEqual(parseArguments(stopCommand, ['--', '--all']).positionals, ['--all'])
  })

  it('suggests the closest option for a typo', () => {
    assert.throws(
      () => parseArguments(stopCommand, ['--al']),
      (error: unknown) => {
        return error instanceof Error && error.message.includes('--al')
      },
    )
  })

  it('refuses more arguments than the command takes', () => {
    assert.throws(() => parseArguments(stopCommand, ['api', 'web']), /more arguments than it takes/)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Problem } from '../problems/Problem.ts'
import { ampulVersion } from '../version.ts'
import { parseSettingsFile, serializeSettings } from './settingsParsing.ts'
import { containerUserProblem, defaultSettings } from './settingsSchema.ts'

const olderVersion = '0.0.1'

function settingsText(content: Record<string, unknown>): string {
  return JSON.stringify(content)
}

function problemTitle(text: string): string {
  let title = ''
  assert.throws(
    () => parseSettingsFile(text),
    (error) => {
      assert.ok(error instanceof Problem)
      title = error.title
      return true
    },
  )
  return title
}

describe('parseSettingsFile', () => {
  it('reads a complete file of this version as it is', () => {
    const parsed = parseSettingsFile(
      serializeSettings({ runtime: 'podman', containerUser: 'me', ignoredPorts: [9229] }),
    )
    assert.deepEqual(parsed.settings, {
      runtime: 'podman',
      containerUser: 'me',
      ignoredPorts: [9229],
    })
    assert.equal(parsed.needsRewrite, false)
  })

  it('writes every setting and the version into the file', () => {
    assert.deepEqual(JSON.parse(serializeSettings(defaultSettings)), {
      ampulVersion,
      runtime: 'auto',
      containerUser: 'dev',
      ignoredPorts: [],
    })
  })

  it('fills in a missing setting with its default and asks for a rewrite', () => {
    const parsed = parseSettingsFile(settingsText({ ampulVersion, runtime: 'docker' }))
    assert.deepEqual(parsed.settings, { runtime: 'docker', containerUser: 'dev', ignoredPorts: [] })
    assert.equal(parsed.needsRewrite, true)
  })

  it('takes a file from another version that still fits, to stamp the current version', () => {
    const parsed = parseSettingsFile(
      settingsText({
        ampulVersion: olderVersion,
        runtime: 'auto',
        containerUser: 'dev',
        ignoredPorts: [],
      }),
    )
    assert.deepEqual(parsed.settings, defaultSettings)
    assert.equal(parsed.needsRewrite, true)
  })

  it('refuses a file that is not JSON', () => {
    assert.match(problemTitle('{ "runtime": '), /is not valid JSON$/)
  })

  it('refuses a setting of the wrong type in a file of this version', () => {
    const text = settingsText({ ampulVersion, runtime: 'auto', containerUser: 7 })
    assert.match(problemTitle(text), /has settings that are not valid$/)
  })

  it('refuses a file of another version that no longer fits as incompatible', () => {
    const text = settingsText({ ampulVersion: olderVersion, engine: 'podman' })
    assert.match(problemTitle(text), new RegExp(`does not work with ampul ${ampulVersion}$`))
  })

  it('refuses unknown settings, runtimes and contents that are not an object', () => {
    for (const content of [
      settingsText({ ampulVersion, runtme: 'podman' }),
      settingsText({ ampulVersion, runtime: 'containerd' }),
      '[]',
    ]) {
      assert.throws(() => parseSettingsFile(content), Problem)
    }
  })
})

describe('containerUserProblem', () => {
  it('accepts Linux user names and refuses the rest', () => {
    assert.equal(containerUserProblem('dev'), undefined)
    assert.equal(containerUserProblem('_build-2'), undefined)
    for (const name of ['', 'Dev', '2dev', 'my user', 'root', 'a'.repeat(33)]) {
      assert.ok(containerUserProblem(name), name)
    }
  })
})

import fs from 'node:fs'
import { resourcePath } from './resourceDirectory.js'

export interface DotnetSdk {
  channel: string
  version: string
}

interface OptionalDependencyBase {
  setting: string
  label: string
  version?: string
  description?: string
}

export interface YesNoDependency extends OptionalDependencyBase {
  kind: 'yes-no'
}

export interface ChoiceDependency extends OptionalDependencyBase {
  kind: 'choice'
  choices: string[]
}

export type OptionalDependency = YesNoDependency | ChoiceDependency

export interface DependencyCatalog {
  ubuntuImage: string
  dotnetSdks: DotnetSdk[]
  optionalDependencies: OptionalDependency[]
}

let cachedCatalog: DependencyCatalog | undefined

export function dependencyCatalog(): DependencyCatalog {
  cachedCatalog ??= loadDependencyCatalog()
  return cachedCatalog
}

export function pinnedVersions(): Map<string, string> {
  const versions = new Map<string, string>()
  const lines = fs.readFileSync(resourcePath('image', 'versions'), 'utf8').split('\n')
  for (const line of lines) {
    const assignment = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!assignment) continue
    const [, name, rawValue] = assignment as [string, string, string]
    versions.set(name, rawValue.replace(/^"(.*)"$/, '$1'))
  }
  return versions
}

function loadDependencyCatalog(): DependencyCatalog {
  const versions = pinnedVersions()
  return {
    ubuntuImage: versions.get('UBUNTU_IMAGE') ?? '',
    dotnetSdks: dotnetSdks(versions),
    optionalDependencies: optionalDependencies(versions),
  }
}

function dotnetSdks(versions: Map<string, string>): DotnetSdk[] {
  const channels = (versions.get('DOTNET_CHANNELS') ?? '').split(/\s+/).filter(Boolean)
  return channels.map((channel) => ({
    channel,
    version: versions.get(`DOTNET_${channel}_VERSION`) ?? channel,
  }))
}

function optionalDependencies(versions: Map<string, string>): OptionalDependency[] {
  const lines = fs.readFileSync(resourcePath('image', 'optional-dependencies'), 'utf8').split('\n')
  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const [setting = '', choices = '', label = '', description] = line.split('|')
      const common = {
        setting,
        label,
        version: versions.get(`${setting}_VERSION`),
        description: description?.trim() || undefined,
      }
      if (choices === 'yes-no') return { ...common, kind: 'yes-no' }
      return { ...common, kind: 'choice', choices: choices.split(',') }
    })
}

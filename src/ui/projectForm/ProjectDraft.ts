import { presetRanges, presetsCoveredBy } from '../../projects/portPresets.js'
import { combinePorts, portRanges, type PortRange } from '../../projects/ports.js'
import type { ProjectSettings } from '../../projects/ProjectSettings.js'

export interface ProjectDraft {
  codeSourceKind: 'repositories' | 'folder'
  repositories: string[]
  folder: string
  onlyGitFiles: boolean
  name: string
  dotnetSdks: string[]
  optionalDependencies: Record<string, string>
  portPresetIds: string[]
  addsOtherPorts: boolean
  otherPortRanges: PortRange[]
}

export function emptyDraft(name = ''): ProjectDraft {
  return {
    codeSourceKind: 'repositories',
    repositories: [],
    folder: '',
    onlyGitFiles: true,
    name,
    dotnetSdks: [],
    optionalDependencies: {},
    portPresetIds: [],
    addsOtherPorts: false,
    otherPortRanges: [],
  }
}

export function draftFromSettings(settings: ProjectSettings): ProjectDraft {
  const source = settings.codeSource
  const { presetIds, otherPorts } = presetsCoveredBy(settings.ports)
  return {
    codeSourceKind: source.kind,
    repositories: source.kind === 'repositories' ? source.repositories : [],
    folder: source.kind === 'folder' ? source.folder : '',
    onlyGitFiles: source.kind === 'folder' ? source.onlyGitFiles : true,
    name: settings.name,
    dotnetSdks: settings.dotnetSdks,
    optionalDependencies: settings.optionalDependencies,
    portPresetIds: presetIds,
    addsOtherPorts: otherPorts.length > 0,
    otherPortRanges: portRanges(otherPorts),
  }
}

export function settingsFromDraft(draft: ProjectDraft): ProjectSettings {
  return {
    name: draft.name,
    codeSource:
      draft.codeSourceKind === 'repositories'
        ? { kind: 'repositories', repositories: draft.repositories }
        : { kind: 'folder', folder: draft.folder, onlyGitFiles: draft.onlyGitFiles },
    dotnetSdks: draft.dotnetSdks,
    optionalDependencies: draft.optionalDependencies,
    ports: draftPorts(draft),
  }
}

export function draftPorts(draft: ProjectDraft): number[] {
  const otherRanges = draft.addsOtherPorts ? draft.otherPortRanges : []
  return combinePorts([...presetRanges(draft.portPresetIds), ...otherRanges])
}

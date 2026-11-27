import { moduleCatalog } from '../../modules/moduleCatalog.ts'
import { defaultModuleIds, withRequiredModules } from '../../modules/moduleSelection.ts'
import type { CodeSource, ProjectSettings } from '../../projects/ProjectSettings.ts'
import { offeredPortPresets, presetRanges, presetsCoveredBy } from '../../projects/portPresets.ts'
import { combinePorts, type PortRange, portRanges } from '../../projects/ports.ts'

export interface ProjectDraft {
  codeSourceKind: CodeSource['kind']
  repositories: string[]
  folders: string[]
  name: string
  modules: string[]
  portPresetIds: string[]
  addsOtherPorts: boolean
  otherPortRanges: PortRange[]
}

export function emptyDraft(name = ''): ProjectDraft {
  return {
    codeSourceKind: 'repositories',
    repositories: [],
    folders: [],
    name,
    modules: defaultModuleIds(moduleCatalog()),
    portPresetIds: [],
    addsOtherPorts: false,
    otherPortRanges: [],
  }
}

export function draftFromSettings(settings: ProjectSettings): ProjectDraft {
  const source = settings.codeSource
  const { presetIds, otherPorts } = presetsCoveredBy(
    settings.ports,
    offeredPortPresets(settings.modules),
  )
  return {
    codeSourceKind: source.kind,
    repositories: source.kind === 'repositories' ? source.repositories : [],
    folders: source.kind === 'folders' ? source.folders : [],
    name: settings.name,
    modules: settings.modules,
    portPresetIds: presetIds,
    addsOtherPorts: otherPorts.length > 0,
    otherPortRanges: portRanges(otherPorts),
  }
}

export function settingsFromDraft(draft: ProjectDraft): ProjectSettings {
  return {
    name: draft.name,
    codeSource: draftCodeSource(draft),
    modules: withRequiredModules(draft.modules, moduleCatalog()),
    ports: draftPorts(draft),
  }
}

function draftCodeSource(draft: ProjectDraft): CodeSource {
  if (draft.codeSourceKind === 'repositories') {
    return { kind: 'repositories', repositories: draft.repositories }
  }
  if (draft.codeSourceKind === 'folders') return { kind: 'folders', folders: draft.folders }
  return { kind: 'pass-through' }
}

export function draftPorts(draft: ProjectDraft): number[] {
  const otherRanges = draft.addsOtherPorts ? draft.otherPortRanges : []
  return combinePorts([...presetRanges(draft.portPresetIds), ...otherRanges])
}

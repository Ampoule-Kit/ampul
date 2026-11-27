import { moduleCatalog } from '../../modules/moduleCatalog.ts'
import { defaultModuleIds, withRequiredModules } from '../../modules/moduleSelection.ts'
import type { CodeSource, ProjectSettings } from '../../projects/ProjectSettings.ts'

export interface ProjectDraft {
  codeSourceKind: CodeSource['kind']
  repositories: string[]
  folders: string[]
  name: string
  modules: string[]
}

export function emptyDraft(name = ''): ProjectDraft {
  return {
    codeSourceKind: 'repositories',
    repositories: [],
    folders: [],
    name,
    modules: defaultModuleIds(moduleCatalog()),
  }
}

export function draftFromSettings(settings: ProjectSettings): ProjectDraft {
  const source = settings.codeSource
  return {
    codeSourceKind: source.kind,
    repositories: source.kind === 'repositories' ? source.repositories : [],
    folders: source.kind === 'folders' ? source.folders : [],
    name: settings.name,
    modules: settings.modules,
  }
}

export function settingsFromDraft(draft: ProjectDraft): ProjectSettings {
  return {
    name: draft.name,
    codeSource: draftCodeSource(draft),
    modules: withRequiredModules(draft.modules, moduleCatalog()),
  }
}

function draftCodeSource(draft: ProjectDraft): CodeSource {
  if (draft.codeSourceKind === 'repositories') {
    return { kind: 'repositories', repositories: draft.repositories }
  }
  if (draft.codeSourceKind === 'folders') return { kind: 'folders', folders: draft.folders }
  return { kind: 'pass-through' }
}

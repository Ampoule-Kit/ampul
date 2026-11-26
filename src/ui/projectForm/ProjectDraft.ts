import type { ProjectSettings } from '../../projects/ProjectSettings.js'

export interface ProjectDraft {
  codeSourceKind: 'repositories' | 'folder'
  repositories: string[]
  folder: string
  onlyGitFiles: boolean
  name: string
  dotnetSdks: string[]
  optionalDependencies: Record<string, string>
  ports: number[]
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
    ports: [],
  }
}

export function draftFromSettings(settings: ProjectSettings): ProjectDraft {
  const source = settings.codeSource
  return {
    codeSourceKind: source.kind,
    repositories: source.kind === 'repositories' ? source.repositories : [],
    folder: source.kind === 'folder' ? source.folder : '',
    onlyGitFiles: source.kind === 'folder' ? source.onlyGitFiles : true,
    name: settings.name,
    dotnetSdks: settings.dotnetSdks,
    optionalDependencies: settings.optionalDependencies,
    ports: settings.ports,
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
    ports: draft.ports,
  }
}

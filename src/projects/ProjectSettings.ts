export interface RepositoriesSource {
  kind: 'repositories'
  repositories: string[]
}

export interface FolderSource {
  kind: 'folder'
  folder: string
  onlyGitFiles: boolean
}

export type CodeSource = RepositoriesSource | FolderSource

export interface DependencySelection {
  dotnetSdks: string[]
  optionalDependencies: Record<string, string>
}

export interface ProjectSettings extends DependencySelection {
  name: string
  codeSource: CodeSource
  ports: number[]
}

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

export interface ProjectSettings {
  name: string
  codeSource: CodeSource
  modules: string[]
  ports: number[]
}

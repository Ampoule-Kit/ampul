import { dependencyCatalog } from '../resources/dependencyCatalog.js'
import type { DependencySelection, ProjectSettings } from './ProjectSettings.js'

export function selectedToolNames(selection: DependencySelection): string[] {
  const catalog = dependencyCatalog()
  const dotnet = selection.dotnetSdks.map((channel) => `.NET ${channel}`)
  const optional = catalog.optionalDependencies.flatMap((dependency) => {
    const value = selection.optionalDependencies[dependency.setting]
    if (!value) return []
    return dependency.kind === 'choice' ? [`${dependency.label} (${value})`] : [dependency.label]
  })
  return [...dotnet, ...optional]
}

export function describePorts(ports: number[]): string {
  return ports.length > 0 ? ports.map((port) => `localhost:${port}`).join(', ') : 'none'
}

export function describeTools(project: ProjectSettings): string {
  const tools = selectedToolNames(project)
  return tools.length > 0 ? tools.join(', ') : 'only the standard tools'
}

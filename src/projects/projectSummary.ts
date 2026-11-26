import { dependencyCatalog } from '../resources/dependencyCatalog.js'
import { formatPortRange, portRanges } from './ports.js'
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
  const ranges = portRanges(ports)
  if (ranges.length === 0) return 'none'
  return ranges.map((range) => `localhost:${formatPortRange(range)}`).join(', ')
}

export function describeTools(project: ProjectSettings): string {
  const tools = selectedToolNames(project)
  return tools.length > 0 ? tools.join(', ') : 'only the standard tools'
}

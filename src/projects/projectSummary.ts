import { moduleCatalog } from '../modules/moduleCatalog.js'
import { describeModuleSelection } from '../modules/moduleSelection.js'
import { formatPortRange, portRanges } from './ports.js'
import type { ProjectSettings } from './ProjectSettings.js'

export function describePorts(ports: number[]): string {
  const ranges = portRanges(ports)
  if (ranges.length === 0) return 'none'
  return ranges.map((range) => `localhost:${formatPortRange(range)}`).join(', ')
}

export function describeTools(project: ProjectSettings): string {
  return describeModuleSelection(project.modules, moduleCatalog())
}

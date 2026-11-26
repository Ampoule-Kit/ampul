import { moduleCatalog } from '../modules/moduleCatalog.ts'
import { describeModuleSelection } from '../modules/moduleSelection.ts'
import type { ProjectSettings } from './ProjectSettings.ts'
import { formatPortRange, portRanges } from './ports.ts'

export function describePorts(ports: number[]): string {
  const ranges = portRanges(ports)
  if (ranges.length === 0) return 'none'
  return ranges.map((range) => `localhost:${formatPortRange(range)}`).join(', ')
}

export function describeTools(project: ProjectSettings): string {
  return describeModuleSelection(project.modules, moduleCatalog())
}

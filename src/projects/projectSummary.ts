import { readReport } from '../forwarding/forwarderFiles.ts'
import { moduleCatalog } from '../modules/moduleCatalog.ts'
import { describeModuleSelection, describeVersionChoices } from '../modules/moduleSelection.ts'
import type { ProjectSettings } from './ProjectSettings.ts'
import { formatPortList } from './ports.ts'

export function describeForwardedPorts(projectName: string): string {
  const report = readReport(projectName)
  if (!report) return 'forwarded to localhost while it runs'
  const parts = [
    report.forwarded.length > 0 ? `localhost ${formatPortList(report.forwarded)}` : '',
    report.unavailable.length > 0
      ? `${formatPortList(report.unavailable)} in use on this machine`
      : '',
  ].filter(Boolean)
  return parts.length > 0 ? parts.join('; ') : 'nothing listening yet'
}

export function describeTools(project: ProjectSettings): string {
  return describeModuleSelection(project, moduleCatalog())
}

export function describeVersions(project: ProjectSettings): string {
  return describeVersionChoices(project, moduleCatalog())
}

import type { ContainerEngine } from '../../../engine/ContainerEngine.ts'
import type { ProjectSettings } from '../../../projects/ProjectSettings.ts'
import { LogFile } from '../../../tasks/LogFile.ts'
import { askYesOrNo } from '../../../ui/askYesOrNo.tsx'
import { runTasks } from '../../../ui/runTasks.tsx'
import { printElement } from '../../../ui/terminal.tsx'
import { openShell } from '../containerAccess.tsx'
import { codeTask, containerTask, imageTask, setupTask } from './buildTasks.ts'
import { retryFailedClones } from './cloneRetry.tsx'
import { ReadySummary } from './ReadySummary.tsx'

async function offerToConnect(engine: ContainerEngine, project: ProjectSettings): Promise<number> {
  const wantsToConnect = await askYesOrNo({
    title: `Connect to ${project.name} now?`,
    yesLabel: 'Connect',
    noLabel: 'Not now',
  })
  return wantsToConnect ? openShell(engine, project) : 0
}

export async function buildProject(
  engine: ContainerEngine,
  project: ProjectSettings,
  interactive: boolean,
): Promise<number> {
  const failedClones: string[] = []
  const recordCloneFailures = (repositories: string[]) => {
    failedClones.push(...repositories)
  }
  const result = await runTasks(
    [
      imageTask(engine, project),
      containerTask(engine, project),
      setupTask(engine, project),
      codeTask(engine, project, recordCloneFailures),
    ],
    new LogFile(project.name, 'build'),
  )
  if (!result.succeeded) throw result.problem

  const unclonedRepositories = await retryFailedClones(engine, project, failedClones, interactive)
  printElement(
    <ReadySummary
      project={project}
      unclonedRepositories={unclonedRepositories}
      warnings={result.warnings}
    />,
  )
  return interactive ? offerToConnect(engine, project) : 0
}

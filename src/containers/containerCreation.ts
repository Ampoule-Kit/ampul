import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import { stopPortForwarding } from '../forwarding/portForwarding.ts'
import { newTunnelToken } from '../forwarding/tunnel.ts'
import { moduleCatalog } from '../modules/moduleCatalog.ts'
import { installationOrder } from '../modules/moduleSelection.ts'
import { Problem } from '../problems/Problem.ts'
import type { ProjectSettings } from '../projects/ProjectSettings.ts'
import { hostTimeZone } from '../system/platform.ts'
import type { TaskContext } from '../tasks/TaskRunner.ts'
import { outputLines } from './containerErrors.ts'
import { containerRunArguments } from './containerRunArguments.ts'
import { unsharedFoldersIn, unsharedFoldersProblem } from './folderSharing.ts'
import { type HostMount, hostConfigMounts } from './hostConfigMounts.ts'
import {
  cacheLabel,
  containerName,
  moduleVolumeName,
  projectLabel,
  sharedCacheVolume,
} from './naming.ts'
import { codeMounts, foldersMountedEmpty } from './projectCode.ts'

async function createVolumeIfMissing(
  engine: ContainerEngine,
  volume: string,
  label: string,
): Promise<void> {
  const { exitCode } = await engine.capture(['volume', 'inspect', volume])
  if (exitCode !== 0) await engine.capture(['volume', 'create', '--label', label, volume])
}

export async function removeContainer(engine: ContainerEngine, projectName: string): Promise<void> {
  await stopPortForwarding(projectName)
  await engine.capture(['rm', '--force', containerName(projectName)])
}

export async function createContainer(
  engine: ContainerEngine,
  project: ProjectSettings,
  context: TaskContext,
): Promise<void> {
  const folderMounts = codeMounts(project)
  const modules = installationOrder(project.modules, moduleCatalog())
  await createVolumeIfMissing(engine, sharedCacheVolume, `${cacheLabel}=true`)
  for (const volume of modules.flatMap((module) => module.container.volumes)) {
    await createVolumeIfMissing(
      engine,
      moduleVolumeName(project.name, volume.name),
      `${projectLabel}=${project.name}`,
    )
  }
  const runArguments = containerRunArguments(project, {
    isRootlessPodman: await engine.isRootlessPodman(),
    hostMounts: [...(await hostConfigMounts()), ...folderMounts],
    modules,
    tunnelToken: newTunnelToken(),
    timeZone: hostTimeZone(),
  })
  const { exitCode, stderr } = await engine.capture(runArguments)
  context.output(stderr)
  if (exitCode !== 0) throw containerCreationFailed(engine, project, folderMounts, stderr)

  const emptyFolders = await foldersMountedEmpty(engine, project, folderMounts)
  if (emptyFolders.length > 0) throw unsharedFoldersProblem(engine, project, emptyFolders)
}

function containerCreationFailed(
  engine: ContainerEngine,
  project: ProjectSettings,
  folderMounts: HostMount[],
  errorOutput: string,
): Problem {
  const unsharedFolders = unsharedFoldersIn(
    errorOutput,
    folderMounts.map((mount) => mount.hostPath),
  )
  if (unsharedFolders.length > 0) {
    return unsharedFoldersProblem(engine, project, unsharedFolders, errorOutput)
  }
  return new Problem('The container could not be created', {
    outputTail: outputLines(errorOutput),
    fixes: [{ description: 'Try again', command: `ampul rebuild ${project.name}` }],
  })
}

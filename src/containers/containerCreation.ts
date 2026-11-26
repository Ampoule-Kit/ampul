import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import { Problem } from '../problems/Problem.ts'
import type { ProjectSettings } from '../projects/ProjectSettings.ts'
import { formatPortList } from '../projects/ports.ts'
import type { TaskContext } from '../tasks/TaskRunner.ts'
import { isPortAlreadyInUse, outputLines } from './containerErrors.ts'
import { containerRunArguments, usesInnerContainerEngine } from './containerRunArguments.ts'
import { hostConfigMounts } from './hostConfigMounts.ts'
import {
  cacheLabel,
  containerName,
  innerEngineVolumeName,
  projectLabel,
  sharedCacheVolume,
} from './naming.ts'

async function createVolumeIfMissing(
  engine: ContainerEngine,
  volume: string,
  label: string,
): Promise<void> {
  const { exitCode } = await engine.capture(['volume', 'inspect', volume])
  if (exitCode !== 0) await engine.capture(['volume', 'create', '--label', label, volume])
}

export async function removeContainer(engine: ContainerEngine, projectName: string): Promise<void> {
  await engine.capture(['rm', '--force', containerName(projectName)])
}

export async function createContainer(
  engine: ContainerEngine,
  project: ProjectSettings,
  context: TaskContext,
): Promise<void> {
  await createVolumeIfMissing(engine, sharedCacheVolume, `${cacheLabel}=true`)
  if (usesInnerContainerEngine(project)) {
    await createVolumeIfMissing(
      engine,
      innerEngineVolumeName(project.name),
      `${projectLabel}=${project.name}`,
    )
  }
  const runArguments = containerRunArguments(project, {
    isRootlessPodman: await engine.isRootlessPodman(),
    hostMounts: await hostConfigMounts(),
  })
  const { exitCode, stderr } = await engine.capture(runArguments)
  context.output(stderr)
  if (exitCode !== 0) throw containerCreationFailed(project, stderr)
}

function containerCreationFailed(project: ProjectSettings, errorOutput: string): Problem {
  if (isPortAlreadyInUse(errorOutput)) {
    return new Problem('A port is already in use on this machine', {
      explanation: `One of the ports ${formatPortList(project.ports)} is taken by another program or project.`,
      outputTail: outputLines(errorOutput),
      fixes: [
        {
          description: 'Stop whatever uses it, or change the ports',
          command: `ampul config ${project.name}`,
        },
        {
          description: 'Then create the container again',
          command: `ampul rebuild ${project.name}`,
        },
      ],
    })
  }
  return new Problem('The container could not be created', {
    outputTail: outputLines(errorOutput),
    fixes: [{ description: 'Try again', command: `ampul rebuild ${project.name}` }],
  })
}

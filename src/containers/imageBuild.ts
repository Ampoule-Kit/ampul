import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import type { ModuleDefinition } from '../modules/ModuleDefinition.ts'
import { moduleCatalog } from '../modules/moduleCatalog.ts'
import {
  describeConflict,
  installationOrder,
  selectionConflicts,
} from '../modules/moduleSelection.ts'
import { Problem } from '../problems/Problem.ts'
import type { ProjectSettings } from '../projects/ProjectSettings.ts'
import { resourceDirectory } from '../resources/resourceDirectory.ts'
import { hostGroupId, hostUserId } from '../system/platform.ts'
import type { TaskContext } from '../tasks/TaskRunner.ts'
import { baseImage, writeContainerfile } from './containerfile.ts'
import {
  describeBuildInstruction,
  isOutOfMemoryMessage,
  parseBuildStep,
} from './imageBuildOutput.ts'
import { containerUser, imageName, projectLabel } from './naming.ts'

function imageBuildArguments(
  engine: ContainerEngine,
  project: ProjectSettings,
  modules: ModuleDefinition[],
): string[] {
  return [
    'build',
    ...(engine.runtime === 'docker' ? ['--progress=plain'] : []),
    '--file',
    writeContainerfile(project.name, modules),
    '--tag',
    imageName(project.name),
    '--label',
    `${projectLabel}=${project.name}`,
    '--build-arg',
    `UBUNTU_IMAGE=${baseImage()}`,
    '--build-arg',
    `USER_NAME=${containerUser()}`,
    '--build-arg',
    `USER_UID=${hostUserId()}`,
    '--build-arg',
    `USER_GID=${hostGroupId()}`,
    resourceDirectory(),
  ]
}

export async function buildImage(
  engine: ContainerEngine,
  project: ProjectSettings,
  context: TaskContext,
): Promise<void> {
  let sawOutOfMemory = false
  const catalog = moduleCatalog()
  const [conflict] = selectionConflicts(project.modules, catalog)
  if (conflict) {
    throw new Problem(`${describeConflict(conflict)} in ${project.name}`, {
      explanation: `Only one module of the exclusive group '${conflict.exclusiveGroup}' can be installed.`,
      fixes: [{ description: 'Choose one of them', command: `ampul config ${project.name}` }],
    })
  }
  const modules = installationOrder(project.modules, catalog)
  const exitCode = await engine.stream(imageBuildArguments(engine, project, modules), {
    environment: engine.runtime === 'docker' ? { DOCKER_BUILDKIT: '1' } : undefined,
    onOutput: context.output,
    onLine: (line) => {
      context.outputLine(line)
      if (isOutOfMemoryMessage(line)) sawOutOfMemory = true
      const step = parseBuildStep(line)
      if (step) {
        context.progress(step.number, step.total)
        context.detail(describeBuildInstruction(step.instruction, modules))
      }
    },
  })
  if (exitCode !== 0) throw imageBuildFailed(project, engine, sawOutOfMemory)
}

function imageBuildFailed(
  project: ProjectSettings,
  engine: ContainerEngine,
  sawOutOfMemory: boolean,
): Problem {
  if (sawOutOfMemory) {
    return new Problem('The image build ran out of memory', {
      explanation: `${engine.displayName} killed the build because it ran out of memory.`,
      fixes: [
        {
          description: 'Give the container engine more memory (see ampul doctor), then build again',
          command: `ampul rebuild ${project.name}`,
        },
      ],
    })
  }
  return new Problem('The image did not build', {
    explanation:
      'A step of the image build failed. The most common causes are a network problem while downloading a tool, or a checksum that no longer matches.',
    fixes: [
      { description: 'Read the output above, or the full log, to see which step failed' },
      { description: 'Build again once it is fixed', command: `ampul rebuild ${project.name}` },
    ],
  })
}

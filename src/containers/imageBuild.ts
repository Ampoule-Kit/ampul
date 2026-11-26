import type { ContainerEngine } from '../engine/ContainerEngine.js'
import { Problem } from '../problems/Problem.js'
import type { ModuleDefinition } from '../modules/ModuleDefinition.js'
import { moduleCatalog } from '../modules/moduleCatalog.js'
import { installationOrder } from '../modules/moduleSelection.js'
import type { ProjectSettings } from '../projects/ProjectSettings.js'
import { resourceDirectory } from '../resources/resourceDirectory.js'
import { hostGroupId, hostUserId } from '../system/platform.js'
import type { TaskContext } from '../tasks/TaskRunner.js'
import { baseImage, writeContainerfile } from './containerfile.js'
import { containerUser, imageName, projectLabel } from './naming.js'

interface BuildStep {
  number: number
  total: number
  instruction: string
}

const podmanStepPattern = /STEP (\d+)\/(\d+): (.*)$/
const dockerStepPattern = /^#\d+ \[[\w-]*\s+(\d+)\/(\d+)\] (.*)$/
const moduleInstallPattern = /install-module\.sh ([\w-]+)/

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
  const modules = installationOrder(project.modules, moduleCatalog())
  const exitCode = await engine.stream(imageBuildArguments(engine, project, modules), {
    environment: engine.runtime === 'docker' ? { DOCKER_BUILDKIT: '1' } : undefined,
    onOutput: context.output,
    onLine: (line) => {
      context.outputLine(line)
      if (/out of memory|signal: killed|exit code: 137/i.test(line)) sawOutOfMemory = true
      const step = parseBuildStep(line)
      if (step) {
        context.progress(step.number, step.total)
        context.detail(describeInstruction(step.instruction, modules))
      }
    },
  })
  if (exitCode !== 0) throw imageBuildFailed(project, engine, sawOutOfMemory)
}

function parseBuildStep(line: string): BuildStep | undefined {
  const match = line.match(podmanStepPattern) ?? line.match(dockerStepPattern)
  if (!match) return undefined
  return { number: Number(match[1]), total: Number(match[2]), instruction: match[3] ?? '' }
}

function describeInstruction(instruction: string, modules: ModuleDefinition[]): string {
  const moduleId = instruction.match(moduleInstallPattern)?.[1]
  const module = modules.find((candidate) => candidate.id === moduleId)
  if (module) return `Installing ${module.label}`
  const keyword = instruction.split(' ')[0]?.toUpperCase()
  if (keyword === 'FROM') return 'Preparing the Ubuntu base image'
  if (keyword === 'COPY') return 'Copying the install scripts'
  if (instruction.includes('apt-get install')) return 'Installing the Ubuntu basics'
  if (instruction.includes('create-user.sh')) return 'Creating your user'
  return 'Configuring the image'
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
          description: 'Give the container engine more memory (see dev doctor), then build again',
          command: `dev rebuild ${project.name}`,
        },
      ],
    })
  }
  return new Problem('The image did not build', {
    explanation:
      'A step of the image build failed. The most common causes are a network problem while downloading a tool, or a checksum that no longer matches.',
    fixes: [
      { description: 'Read the output above, or the full log, to see which step failed' },
      { description: 'Build again once it is fixed', command: `dev rebuild ${project.name}` },
    ],
  })
}

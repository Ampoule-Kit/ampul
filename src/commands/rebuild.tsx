import { type CommandDefinition, type Invocation, yesFlag } from '../cli/CommandDefinition.ts'
import { containerState } from '../containers/containerState.ts'
import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import { moduleCatalog } from '../modules/moduleCatalog.ts'
import { moduleVolumes } from '../modules/moduleSelection.ts'
import type { ProjectSettings } from '../projects/ProjectSettings.ts'
import { confirmDestructiveAction } from './shared/confirmation.tsx'
import { connectToEngine } from './shared/engineConnection.tsx'
import { buildProject } from './shared/projectBuild/buildProject.tsx'
import { selectProject } from './shared/projectSelection.tsx'

export async function confirmAndRebuild(
  engine: ContainerEngine,
  project: ProjectSettings,
  invocation: Invocation,
): Promise<number> {
  if ((await containerState(engine, project.name)) !== 'missing') {
    await confirmDestructiveAction({
      invocation,
      commandLine: `ampul rebuild ${project.name}`,
      title: `Rebuilding recreates ${project.name} from scratch.`,
      lost: [
        ...(project.codeSource.kind === 'repositories'
          ? ['The clones in ~/work, including uncommitted and unpushed work']
          : []),
        'Anything else you changed inside the container',
      ],
      kept: [
        ...(project.codeSource.kind === 'repositories'
          ? []
          : ['The folders mounted in ~/work, which stay on this machine']),
        'The shared package cache (everything in ~/.cache)',
        ...moduleVolumes(project, moduleCatalog()).map((volume) => volume.contents),
        'The project settings',
      ],
      yesLabel: 'Rebuild',
    })
  }
  return buildProject(engine, project, invocation.interactive)
}

async function run(invocation: Invocation): Promise<number> {
  const engine = await connectToEngine(invocation.interactive)
  const project = await selectProject({
    invocation,
    engine,
    commandName: 'rebuild',
    question: 'Which project do you want to rebuild?',
  })
  return confirmAndRebuild(engine, project, invocation)
}

export const rebuildCommand: CommandDefinition = {
  name: 'rebuild',
  summary: 'Rebuild the image and recreate the container with fresh code',
  arguments: [
    {
      name: 'project',
      required: false,
      description: 'The project to rebuild. When left out, ampul rebuild lets you pick one.',
    },
  ],
  flags: [yesFlag],
  description: [
    'Builds the image again with the project’s current settings and pinned tool versions, replaces the container, sets it up and fetches the code again. Use it after ampul config, after pinning a new tool version, or when a container is broken.',
    'Image layers that did not change are reused, so a rebuild is much faster than the first build.',
    'The container is thrown away, and cloned repositories in ~/work with it: push your work first. Mounted folders stay on this machine.',
  ],
  examples: [
    { command: 'ampul rebuild api', explanation: 'Rebuild api after confirming.' },
    {
      command: 'ampul rebuild api --yes',
      explanation: 'Rebuild without asking, for example from a script.',
    },
  ],
  seeAlso: ['config', 'setup'],
  run,
}

import { yesFlag, type CommandDefinition, type Invocation } from '../cli/CommandDefinition.js'
import { containerState } from '../containers/containerState.js'
import { usesInnerContainerEngine } from '../containers/containerCreation.js'
import type { ContainerEngine } from '../engine/ContainerEngine.js'
import type { ProjectSettings } from '../projects/ProjectSettings.js'
import { confirmDestructiveAction } from './shared/confirmation.js'
import { connectToEngine } from './shared/engineConnection.js'
import { buildProject } from './shared/projectBuild.js'
import { selectProject } from './shared/projectSelection.js'

export async function confirmAndRebuild(
  engine: ContainerEngine,
  project: ProjectSettings,
  invocation: Invocation,
): Promise<number> {
  if ((await containerState(engine, project.name)) !== 'missing') {
    await confirmDestructiveAction({
      invocation,
      commandLine: `dev rebuild ${project.name}`,
      title: `Rebuilding recreates ${project.name} from scratch.`,
      lost: [
        'Everything in ~/Project, including uncommitted and unpushed work',
        'Anything else you changed inside the container',
      ],
      kept: [
        'The shared package cache (NuGet, npm and other ~/.cache data)',
        ...(usesInnerContainerEngine(project)
          ? ['Images and data of the containers run inside the project']
          : []),
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
      description: 'The project to rebuild. When left out, dev rebuild lets you pick one.',
    },
  ],
  flags: [yesFlag],
  description: [
    'Builds the image again with the project’s current settings and pinned tool versions, replaces the container, sets it up and fetches the code again. Use it after dev config, after pinning a new tool version, or when a container is broken.',
    'Image layers that did not change are reused, so a rebuild is much faster than the first build.',
    'The container is thrown away, and ~/Project with it: push your work first.',
  ],
  examples: [
    { command: 'dev rebuild api', explanation: 'Rebuild api after confirming.' },
    {
      command: 'dev rebuild api --yes',
      explanation: 'Rebuild without asking, for example from a script.',
    },
  ],
  seeAlso: ['config', 'setup'],
  run,
}
